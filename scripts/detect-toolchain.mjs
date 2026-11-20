#!/usr/bin/env node
// Probe Node, esbuild, BLA L3 — emit JSON for Anti-ReA Skill route caps.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { esbuildAvailable } from "../superblue/src/harden.mjs";
import { tarpitAvailable } from "../superblue/src/tarpit.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(scriptDir, "..");

function resolveBlaRoot() {
  const envRoot = process.env.ARS_ROOT || process.env.BLA_ROOT;
  if (envRoot) return resolve(envRoot);
  const cwd = process.cwd();
  if (existsSync(join(cwd, "superblue", "src", "index.mjs"))) return cwd;
  if (existsSync(join(cwd, ".anti-rea-superblue", "superblue", "src", "index.mjs"))) return join(cwd, ".anti-rea-superblue");
  if (existsSync(join(cwd, ".bla-hardened", "superblue", "src", "index.mjs"))) return join(cwd, ".bla-hardened");
  return defaultRoot;
}

const blaRoot = resolveBlaRoot();
const nodeV = process.versions.node;
const major = parseInt(nodeV.split(".")[0], 10);
const nodeOk = major >= 20;
const nodeTarpitOk = major >= 22;
const esb = esbuildAvailable();
const bla = tarpitAvailable();
const npxBla = spawnSync("npx", ["bla-agents@latest", "--version"], { encoding: "utf8", timeout: 15000 });
const npxBlaOk = npxBla.status === 0;

const routeCaps = {
  R0: true,
  R1: nodeOk,
  R2: nodeOk && (bla || npxBlaOk),
  R3: nodeOk,
  R4: nodeOk,
};

const notes = [];
if (!nodeOk) notes.push("Node 20+ required for SuperBlue.");
if (!esb) notes.push("esbuild missing: L2 will strip-only fallback (install esbuild in BLA_ROOT/upstream-src or PATH).");
if (!bla && !npxBlaOk) notes.push("BLA CLI not found: R2/max-friction L3 skipped; R1 still works with --no-tarpit.");
if (!nodeTarpitOk) notes.push("Node 22+ recommended for BLA tarpit local fork.");

const out = {
  blaRoot,
  skillVersion: process.env.ARS_REF || process.env.BLA_HARDENED_REF || "main",
  node: { version: nodeV, ok: nodeOk, tarpitRecommended: nodeTarpitOk },
  esbuild: { ok: esb },
  blaTarpit: { localFork: bla, npxAgents: npxBlaOk, ok: bla || npxBlaOk },
  routeCaps,
  notes,
  commands: {
    superblue: `node ${join(blaRoot, "superblue/src/index.mjs")}`,
    detect: `node ${join(blaRoot, "scripts/detect-toolchain.mjs")}`,
  },
};

if (process.argv.includes("--json") || process.argv.includes("-j")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const [k, v] of Object.entries(routeCaps)) console.log(`${k}: ${v ? "ok" : "blocked"}`);
  for (const n of notes) console.log("note:", n);
}
process.exit(nodeOk ? 0 : 2);