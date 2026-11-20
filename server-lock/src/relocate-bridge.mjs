// Optional hook: when SuperBlue relocate writes logic-relocated.mjs, premium uses it.
let _relocated = null;

export async function loadRelocated() {
  if (_relocated !== null) return _relocated;
  try {
    const m = await import("./logic-relocated.mjs");
    const fn = m.checkLicense || m.default || Object.values(m).find((x) => typeof x === "function");
    _relocated = typeof fn === "function" ? fn : false;
  } catch {
    _relocated = false;
  }
  return _relocated;
}

export async function premiumViaRelocated(input) {
  const fn = await loadRelocated();
  if (!fn) return null;
  const out = fn(String(input));
  return typeof out === "string" ? out : JSON.stringify(out);
}