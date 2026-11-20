// L0 ship helper (from antirea strip-sourcemaps pattern).
// Deletes *.map under a directory and strips //# sourceMappingURL from JS.
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";

const MAP_COMMENT = /\/\/[#@]\s*sourceMappingURL=\S+/gm;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

export function stripDist(distDir, { dryRun = false } = {}) {
  const files = walk(distDir);
  let deletedMaps = 0, patchedJs = 0;
  for (const f of files) {
    if (f.endsWith(".map")) {
      if (!dryRun) unlinkSync(f);
      deletedMaps++;
      continue;
    }
    if (/\.(m?js|cjs)$/i.test(f)) {
      const raw = readFileSync(f, "utf8");
      const next = raw.replace(MAP_COMMENT, "");
      if (next !== raw) {
        if (!dryRun) writeFileSync(f, next);
        patchedJs++;
      }
    }
  }
  return { distDir, deletedMaps, patchedJs, dryRun };
}