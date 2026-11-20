#!/usr/bin/env node
/**
 * Anti-ReA Skill: SuperBlue — single intake for agents & humans.
 * detect → pick route → emit executable step plan (JSON).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(scriptDir, "..");

function blaRoot() {
  if (process.env.BLA_ROOT) return resolve(process.env.BLA_ROOT);
  const cwd = process.cwd();
  if (existsSync(join(cwd, "superblue", "src", "index.mjs"))) return cwd;
  if (existsSync(join(cwd, ".anti-rea-superblue", "superblue", "src", "index.mjs"))) return join(cwd, ".anti-rea-superblue");
  if (existsSync(join(cwd, ".bla-hardened", "superblue", "src", "index.mjs"))) return join(cwd, ".bla-hardened");
  return defaultRoot;
}

function parseArgs(argv) {
  const o = {
    route: "auto",
    target: "",
    gate: "critical",
    backend: null,
    strength: Number(process.env.STRENGTH_TIER || 8) >= 8 ? 8 : 0,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--route") o.route = argv[++i];
    else if (a === "--target") o.target = resolve(argv[++i]);
    else if (a === "--gate") o.gate = argv[++i];
    else if (a === "--backend") o.backend = true;
    else if (a === "--no-backend") o.backend = false;
    else if (a === "--strength") o.strength = Number(argv[++i]) || 8;
    else if (a === "--json") o.json = true;
    else if (a === "--help") o.help = true;
  }
  return o;
}

function runDetect(root) {
  const r = spawnSync(process.execPath, [join(root, "scripts/detect-toolchain.mjs"), "--json"], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, BLA_ROOT: root },
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "detect failed").slice(0, 500));
  return JSON.parse(r.stdout);
}

function pickRoute({ route, target, backend, strength }, detect) {
  const caps = detect.routeCaps || {};
  if (route !== "auto") return route.toUpperCase();

  const hasBackend =
    backend === true ||
    (backend === null && existsSync(join(process.cwd(), "server-lock", "src", "server.mjs")));

  if (!target) return caps.R0 ? "R0" : "R0";

  // Strength 8 default: architectural lock + thin client ship (not R1-only friction).
  if (strength >= 8 && target) {
    if (caps.R3) return "R8";
    return caps.R1 ? "R1" : "R0";
  }

  if (!hasBackend && existsSync(target) && target.endsWith(".js")) return caps.R1 ? "R1" : caps.R0;
  if (hasBackend && target) return caps.R4 ? "R4" : caps.R3 ? "R3" : "R1";
  return "R0";
}

function stepPlan(route, target, gate, root) {
  const SB = `node ${join(root, "superblue/src/index.mjs")}`;
  const steps = [];
  steps.push({ id: "detect", cmd: `node ${join(root, "scripts/detect-toolchain.mjs")} --json`, required: true });
  steps.push({ id: "verify", cmd: `bash ${join(root, "scripts/verify-skill-install.sh")}`, required: false });

  const T = target || join(root, "sample/license.js");

  switch (route) {
    case "R0":
      steps.push({ id: "scan", cmd: `${SB} scan ${JSON.stringify(T)} --block-level ${gate} --json`, required: true });
      break;
    case "R1":
      steps.push({ id: "oracle", cmd: `node ${join(root, "scripts/generate-oracle.mjs")} ${JSON.stringify(T)} .superblue-oracles/auto.mjs`, required: true, confirm: "user confirms oracle once" });
      steps.push({ id: "scan-pre", cmd: `${SB} scan ${JSON.stringify(T)} --block-level critical`, required: true });
      steps.push({ id: "run", cmd: `${SB} run ${JSON.stringify(T)} --oracle .superblue-oracles/auto.mjs --no-tarpit --out .superblue-out --block-level ${gate}`, required: true });
      steps.push({ id: "scan-ship", cmd: `${SB} scan .superblue-out/shipped --block-level critical`, required: true });
      break;
    case "R2":
      steps.push({ id: "oracle", cmd: `node ${join(root, "scripts/generate-oracle.mjs")} ${JSON.stringify(T)} .superblue-oracles/auto.mjs`, required: true, confirm: true });
      steps.push({ id: "run", cmd: `${SB} run ${JSON.stringify(T)} --oracle .superblue-oracles/auto.mjs --max-friction --out .superblue-friction`, required: true, note: "do not ship to prod" });
      steps.push({ id: "test-rea", cmd: `${SB} test-rea .superblue-friction/shipped --skip-raised --out .superblue-friction/rea`, required: false });
      break;
    case "R3":
      steps.push({ id: "relocate", cmd: `${SB} relocate ${JSON.stringify(T)} --server-lock`, required: true });
      steps.push({ id: "keygen", cmd: `node server-lock/src/keygen.mjs`, cwd: "server-lock", required: true, note: "copy server-lock from BLA_ROOT first if missing" });
      steps.push({ id: "demo", cmd: `node server-lock/src/demo.mjs`, cwd: "server-lock", required: true });
      break;
    case "R8": {
      const r4 = stepPlan("R4", target, gate, root);
      steps.push(...r4.steps.filter((s) => s.id !== "detect" && s.id !== "verify"));
      steps.push({
        id: "strength-8",
        cmd: `STRENGTH_TIER=8 node ${join(root, "scripts/strength-8-check.mjs")} ${JSON.stringify(T)} --json`,
        required: true,
        note: "score must be >= 8/10",
      });
      break;
    }
    case "R4":
      steps.push({ id: "relocate", cmd: `${SB} relocate ${JSON.stringify(T)} --server-lock`, required: true });
      steps.push({ id: "vendor-lock", cmd: `test -d server-lock/src/server.mjs || cp -R ${JSON.stringify(join(root, "server-lock"))} ./server-lock`, required: true });
      steps.push({ id: "keygen", cmd: `node server-lock/src/keygen.mjs`, required: true });
      steps.push({ id: "demo", cmd: `node server-lock/src/demo.mjs`, required: true });
      steps.push({
        id: "oracle-client",
        cmd: `node ${join(root, "scripts/generate-oracle.mjs")} relocate-out/*.client.mjs .superblue-oracles/client-auto.mjs`,
        required: false,
        note: "pick actual client filename if glob fails",
      });
      steps.push({
        id: "run-client",
        cmd: `${SB} run relocate-out/<fn>.client.mjs --oracle .superblue-oracles/client-auto.mjs --no-tarpit --out .superblue-out`,
        required: true,
        confirm: "agent resolves client path from relocate-out",
      });
      steps.push({ id: "scan-client", cmd: `${SB} scan relocate-out --block-level critical`, required: true });
      break;
    default:
      steps.push({ id: "error", note: `unknown route ${route}`, required: false });
  }
  return steps;
}

function capRoute(route, caps) {
  const key = route === "R8" ? "R3" : route;
  if (caps[key] === false) {
    const fallbacks = { R2: "R1", R4: "R3", R8: "R1", R3: "R0", R1: "R0" };
    const fb = fallbacks[route] || "R0";
    return { route: fb, downgraded: true, reason: `${route} blocked by toolchain` };
  }
  return { route, downgraded: false };
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`usage: skill-intake.mjs [--route auto|R0|R1|R2|R3|R4] [--target path] [--gate critical|high|moderate] [--backend|--no-backend] [--json]`);
  process.exit(0);
}

const root = blaRoot();
const detect = runDetect(root);
let route = pickRoute(args, detect);
const capped = capRoute(route, detect.routeCaps);
route = capped.route;

const plan = {
  skill: "Anti-ReA Skill: SuperBlue",
  version: "0.4.2",
  strengthTier: args.strength,
  blaRoot: root,
  route,
  routeRequested: args.route,
  downgraded: capped.downgraded,
  downgradeReason: capped.reason || null,
  target: args.target || null,
  gate: args.gate,
  detect: { routeCaps: detect.routeCaps, notes: detect.notes },
  steps: stepPlan(route, args.target, args.gate, root),
  agent: {
    playbook: join(root, ".cursor/skills/anti-rea-superblue/AGENT-PLAYBOOK.md"),
    failures: join(root, ".cursor/skills/anti-rea-superblue/failures.md"),
    instruction: "Execute steps in order; stop on required failure; read failures.md",
  },
};

if (args.json) console.log(JSON.stringify(plan, null, 2));
else {
  console.log(`Route: ${plan.route}${plan.downgraded ? " (downgraded)" : ""}`);
  for (const s of plan.steps) console.log(`- [${s.id}]${s.confirm ? " (confirm)" : ""} ${s.cmd || s.note}`);
}
process.exit(detect.node?.ok ? 0 : 2);