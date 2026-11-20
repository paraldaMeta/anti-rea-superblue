// SuperBlue L3 — Tarpit (lowest-value, casual-attacker-only).
// Wraps the hardened BLA fork (`bla-agents-hardened`). HONEST FRAMING: this only
// raises cost for an analyst who runs REA at DEFAULT budget. As measured in this
// repo, a single `--semantic-precision` raise neutralises it in ~15s. Included
// as a speed bump, explicitly NOT as a wall.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const NODE = process.env.SUPERBLUE_NODE
  || join(repoRoot, "node-v24.22.3-darwin-arm64", "bin", "node");
const BLA_CLI = process.env.SUPERBLUE_BLA_CLI
  || join(repoRoot, "upstream-src", "dist", "cli.js");
const BLA_CWD = join(repoRoot, "upstream-src");

export function tarpitAvailable() {
  return existsSync(BLA_CLI) && existsSync(NODE);
}

export function tarpit(inPath, outPath) {
  if (!tarpitAvailable()) return { applied: false, note: "bla fork cli not found; L3 skipped" };
  const node = existsSync(NODE) ? NODE : "node";
  const r = spawnSync(node, [BLA_CLI, "protect", inPath, "-o", outPath], { cwd: BLA_CWD, encoding: "utf8" });
  if (r.status !== 0 || !existsSync(outPath)) {
    return { applied: false, note: "bla protect failed", stderr: (r.stderr || "").slice(0, 400) };
  }
  const beforeBytes = statSync(inPath).size;
  const afterBytes = statSync(outPath).size;
  const mult = beforeBytes ? +(afterBytes / beforeBytes).toFixed(1) : null;
  return { applied: true, tool: "bla-agents-hardened protect (bankrupt)", beforeBytes, afterBytes, sizeMultiplier: mult };
}
