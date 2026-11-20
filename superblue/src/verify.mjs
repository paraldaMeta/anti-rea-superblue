// SuperBlue — behavioural equivalence check (process-isolated).
// Spawns verify-worker.mjs in a child process with a timeout, so a target's
// import-time side effects cannot reach the orchestrator. This is OS-process
// ISOLATION with a wall-clock bound — NOT a security sandbox. Run only on code
// you own. Oracle contract: export { entry, samples(), equals? }.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const WORKER = join(here, "verify-worker.mjs");

export async function verifyEquivalence(originalPath, candidatePath, oraclePath, { timeoutMs = 60_000 } = {}) {
  const r = spawnSync(process.execPath, [WORKER, resolve(originalPath), resolve(candidatePath), resolve(oraclePath)], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    killSignal: "SIGKILL",
    env: { ...process.env, NODE_OPTIONS: "" }, // don't inherit loaders
  });
  if (r.error && r.error.code === "ETIMEDOUT") {
    return { pass: false, error: `equivalence worker timed out after ${timeoutMs}ms`, isolated: true };
  }
  if (r.status !== 0 && !r.stdout) {
    return { pass: false, error: `worker exited ${r.status}: ${(r.stderr || "").slice(0, 300)}`, isolated: true };
  }
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop() || "{}";
  try { return { ...JSON.parse(line), isolated: true }; }
  catch { return { pass: false, error: "unparseable worker output", raw: line.slice(0, 200), isolated: true }; }
}
