// REA default-budget vs raised-budget regression (measured, not modeled).
// Uses bundled Node 24 + npx rea-agents when available.
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAISED = '{"alias_selections":65536,"getter_expansions":65536,"primitive_candidates":65536,"expression_depth":65536}';

function resolveNode() {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const localNode = join(repoRoot, "node-v24.22.3-darwin-arm64", "bin", "node");
  return existsSync(localNode) ? localNode : process.execPath;
}

function runRea(target, { semantic, timeoutMs = 320_000 }) {
  const node = resolveNode();
  const npx = join(dirname(node), "npx");
  const args = ["-y", "rea-agents@latest", "analyze-javascript-application", target, "--format", "json"];
  if (semantic) args.push("--semantic-precision", semantic);
  args.push("--analysis-timeout-ms", String(timeoutMs));
  const start = Date.now();
  const r = existsSync(npx)
    ? spawnSync(node, [npx, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs + 30_000 })
    : spawnSync("npx", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs + 30_000 });
  const elapsedMs = Date.now() - start;
  const stdout = r.stdout || "";
  let parsed = null;
  try { parsed = JSON.parse(stdout); } catch { /* */ }
  const timeout = /provider_timeout|"category":"timeout"/.test(stdout) || r.status === 124;
  const ok = !timeout && r.status === 0 && !!parsed?.evidence_id;
  return {
    ok, timeout, exitCode: r.status ?? (r.error && 1),
    elapsedMs, outBytes: Buffer.byteLength(stdout, "utf8"),
    parsed: parsed ? { evidence_id: parsed.evidence_id, error: parsed.error } : null,
    stderrHead: (r.stderr || "").slice(0, 300),
  };
}

export function testRea(targetPath, outDir, { skipRaised = false, quickRaised = true } = {}) {
  const target = resolve(targetPath);
  mkdirSync(outDir, { recursive: true });
  const report = { target, node: resolveNode(), runs: {} };

  report.runs.defaultBudget = runRea(target, {});
  if (!skipRaised) {
    report.runs.raisedBudget = runRea(target, { semantic: RAISED, timeoutMs: quickRaised ? 120_000 : 320_000 });
  }

  const def = report.runs.defaultBudget;
  const raised = report.runs.raisedBudget;
  report.verdict = {
    frictionWorks: !!(def.timeout || (!def.ok && def.elapsedMs > 60_000)),
    bypassable: raised ? !!(raised.ok && raised.elapsedMs < 60_000) : undefined,
    honestNote: "Friction = default REA times out or is very slow; bypass = raised budget completes quickly.",
  };
  report.exitCode = report.verdict.frictionWorks ? 0 : 1;

  writeFileSync(join(outDir, "rea-regression.json"), JSON.stringify(report, null, 2));
  return report;
}