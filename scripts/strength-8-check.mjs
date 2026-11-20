#!/usr/bin/env node
// Operational anti-REA posture score (honest 0–10). Target ~8 = L1 lock + L0 clean ship + no L3 prod.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { scan } from "../superblue/src/scan.mjs";

function blaRoot() {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "superblue", "src", "index.mjs"))) return cwd;
  if (existsSync(join(cwd, ".anti-rea-superblue", "superblue", "src", "index.mjs"))) return join(cwd, ".anti-rea-superblue");
  if (existsSync(join(cwd, ".bla-hardened", "superblue", "src", "index.mjs"))) return join(cwd, ".bla-hardened");
  return resolve(import.meta.dirname, "..");
}

const root = process.cwd();
const bla = blaRoot();
const target = resolve(process.argv[2] || join(bla, "sample/license.js"));
const json = process.argv.includes("--json");

const checks = [];
let pts = 0;
const max = 100;

function add(id, ok, weight, detail) {
  checks.push({ id, ok, weight, detail });
  if (ok) pts += weight;
}

const s0 = scan(target);
add("L0_target_clean", s0.findings.every((f) => f.severity !== "CRITICAL"), 20,
  `target CRITICAL=${s0.findings.filter((f) => f.severity === "CRITICAL").length}`);

const thinDir = existsSync(join(root, "relocate-out")) ? join(root, "relocate-out") : null;
if (thinDir) {
  const sc = scan(thinDir);
  add("L0_thin_client_clean", sc.findings.every((f) => f.severity !== "CRITICAL"), 20,
    `relocate-out CRITICAL=${sc.findings.filter((f) => f.severity === "CRITICAL").length}`);
} else {
  add("L0_thin_client_clean", false, 20, "no relocate-out — run R3/R8 first");
}

const lockDir = existsSync(join(root, "server-lock/src/server.mjs"))
  ? join(root, "server-lock")
  : existsSync(join(bla, "server-lock/src/server.mjs"))
    ? join(bla, "server-lock")
    : null;
add("L1_server_lock", !!lockDir, 25, lockDir || "missing server-lock");

const logicRel = existsSync(join(root, "server-lock/src/logic-relocated.mjs"))
  ? join(root, "server-lock/src/logic-relocated.mjs")
  : join(lockDir || root, "src/logic-relocated.mjs");
add("L1_logic_relocated", existsSync(logicRel), 15, existsSync(logicRel) ? "logic-relocated.mjs present" : "run relocate --server-lock");

const shipped = join(root, ".superblue-out/report.json");
let noTarpit = false;
if (existsSync(shipped)) {
  try {
    const rep = JSON.parse(readFileSync(shipped, "utf8"));
    noTarpit = !rep.layers?.L3_tarpit?.applied;
    add("prod_no_tarpit", noTarpit, 10, noTarpit ? "L3 off in last run" : "L3 was on — use --no-tarpit for prod");
  } catch {
    add("prod_no_tarpit", false, 10, "report.json unreadable");
  }
} else {
  add("prod_no_tarpit", true, 10, "no .superblue-out (assume prod policy --no-tarpit)");
}

const demo = lockDir && spawnSync(process.execPath, [join(lockDir, "src/demo.mjs")], {
  encoding: "utf8",
  timeout: 30000,
  cwd: lockDir,
});
add("L1_demo_attacks", demo?.status === 0, 10, demo?.status === 0 ? "demo.mjs pass" : "demo.mjs not run or fail");

const raw = Math.round((pts / max) * 10 * 10) / 10;
// Honest ceiling: checklist cannot claim >8 vs funded REA / behavioural cloning.
const score = Math.min(8, raw);
const tier = score >= 8 ? "strength-8-met" : score >= 6 ? "partial" : "weak";

const out = {
  score,
  tier,
  points: pts,
  maxPoints: max,
  strengthTierEnv: Number(process.env.STRENGTH_TIER || 8),
  checks,
  honest: "8/10 means architectural L1 + clean L0 ship; raised-budget REA and Craft-on-client still bypass moat-only.",
};

if (json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`Anti-REA posture: ${score}/10 (${tier})`);
  for (const c of checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}: ${c.detail}`);
}
process.exit(score >= 8 ? 0 : 2);