// DeRea-inspired optional Docker isolation for equivalence checks.
// Falls back to process-isolated verify when Docker is unavailable.
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyEquivalence } from "./verify.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const WORKER = join(here, "verify-worker.mjs");

function dockerOk() {
  const r = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim();
}

export async function verifyEquivalenceIsolated(originalPath, candidatePath, oraclePath, opts = {}) {
  const image = opts.dockerImage || process.env.SUPERBLUE_DOCKER_NODE || "node:24-bookworm-slim";
  const timeoutMs = opts.timeoutMs ?? 60_000;
  if (opts.preferDocker === false || !dockerOk()) {
    return verifyEquivalence(originalPath, candidatePath, oraclePath, { timeoutMs });
  }
  const root = resolve(opts.dockerRoot || process.env.SUPERBLUE_DOCKER_ROOT || process.cwd());
  const rel = (p) => {
    const a = resolve(p);
    if (!a.startsWith(root + "/") && a !== root) return null;
    return a.slice(root.length + 1);
  };
  const ro = rel(originalPath), rc = rel(candidatePath), rw = rel(oraclePath);
  if (!ro || !rc || !rw) {
    return verifyEquivalence(originalPath, candidatePath, oraclePath, { timeoutMs });
  }
  const cmd = [
    "run", "--rm", "--network=none", "--read-only",
    "-v", `${root}:/work:ro`,
    "-v", `${WORKER}:/work/.superblue-verify-worker.mjs:ro`,
    image, "node", "/work/.superblue-verify-worker.mjs",
    `/work/${ro}`, `/work/${rc}`, `/work/${rw}`,
  ];
  const r = spawnSync("docker", cmd, { encoding: "utf8", timeout: timeoutMs + 5000 });
  if (r.status !== 0 && !r.stdout) {
    return { pass: false, error: `docker verify failed: ${(r.stderr || "").slice(0, 300)}`, isolated: "docker", fallback: false };
  }
  const line = (r.stdout || "").trim().split("\n").filter(Boolean).pop() || "{}";
  try {
    return { ...JSON.parse(line), isolated: "docker" };
  } catch {
    return { pass: false, error: "unparseable docker worker output", isolated: "docker" };
  }
}