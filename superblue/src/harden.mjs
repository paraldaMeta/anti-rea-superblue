// SuperBlue L2 — Readability hardening (DeRea-style), semantics-preserving.
// Uses esbuild to minify + mangle local identifiers and strip comments/source
// maps. Export names are preserved (so the public contract still works and the
// equivalence oracle can call it). This is DURABLE friction: unlike a tarpit,
// mangling does not evaporate when an analyst raises a budget — but it also does
// not stop a determined analyst. Honest middle layer.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const ESBUILD = process.env.SUPERBLUE_ESBUILD
  || join(repoRoot, "upstream-src", "node_modules", ".bin", "esbuild");

export function esbuildAvailable() {
  if (!existsSync(ESBUILD)) return false;
  const r = spawnSync(ESBUILD, ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

// Remove any trailing source-map reference (external or inline) — always safe.
function stripSourceMapRef(code) {
  return code.replace(/\n?\/\/[#@]\s*sourceMappingURL=.*$/gm, "");
}

export function harden(inPath, outPath, { format = "esm" } = {}) {
  const before = readFileSync(inPath, "utf8");
  if (!esbuildAvailable()) {
    // Fallback: at least strip source-map refs and collapse (no mangling).
    const stripped = stripSourceMapRef(before);
    writeFileSync(outPath, stripped);
    return { tool: "fallback-strip-only", mangled: false, beforeBytes: before.length, afterBytes: stripped.length, note: "esbuild not found; only source-map refs stripped" };
  }
  const args = [
    inPath,
    "--minify",                // mangle locals + compress + remove whitespace
    "--format=" + format,
    "--legal-comments=none",   // drop all comments (incl. engineering notes)
    "--charset=utf8",
    "--outfile=" + outPath,
  ];
  const r = spawnSync(ESBUILD, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("esbuild failed: " + (r.stderr || r.stdout));
  let out = readFileSync(outPath, "utf8");
  out = stripSourceMapRef(out);
  writeFileSync(outPath, out);

  // Count identifier-length reduction as a readability proxy.
  const idBefore = (before.match(/[A-Za-z_$][A-Za-z0-9_$]{3,}/g) || []).length;
  const idAfter = (out.match(/[A-Za-z_$][A-Za-z0-9_$]{3,}/g) || []).length;
  return {
    tool: "esbuild --minify",
    mangled: true,
    beforeBytes: before.length,
    afterBytes: out.length,
    longIdentifiersBefore: idBefore,
    longIdentifiersAfter: idAfter,
    identifierReductionPct: idBefore ? +(100 * (1 - idAfter / idBefore)).toFixed(1) : 0,
  };
}
