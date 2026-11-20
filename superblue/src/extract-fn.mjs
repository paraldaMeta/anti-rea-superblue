// Extract a top-level export function body (brace-balanced). Best-effort for simple modules.
export function extractExportedFunction(source, name) {
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, "m");
  const m = source.match(re);
  if (!m) return null;
  const start = source.indexOf("{", m.index);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const body = source.slice(start + 1, i);
        return { params: m[0].match(/\(([^)]*)\)/)?.[1]?.split(",").map((s) => s.trim()).filter(Boolean) || [], body: body.trim() };
      }
    }
  }
  return null;
}