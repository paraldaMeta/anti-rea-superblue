// REAShield-inspired L1 scaffold: move valuable logic server-side, ship only RPC.
// Parses a simple ES module, hoists the named export body into a server skeleton,
// and emits a thin client. Does NOT rewrite your app automatically — review output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

export function parseSimpleExport(source) {
  const fn = source.match(/export\s+function\s+(\w+)\s*\(([^)]*)\)/);
  const constFn = source.match(/export\s+const\s+(\w+)\s*=\s*(\([^)]*\)|\w+)\s*=>/);
  if (fn) return { name: fn[1], params: fn[2].split(",").map((s) => s.trim()).filter(Boolean) };
  if (constFn) return { name: constFn[1], params: [] };
  const def = source.match(/export\s+default\s+function\s+(\w+)?\s*\(([^)]*)\)/);
  if (def) return { name: def[1] || "default", params: (def[2] || "").split(",").map((s) => s.trim()).filter(Boolean) };
  return null;
}

export function generateRelocate({ exportName, params, apiBase = "https://api.example.com", product = "app" }) {
  const argNames = params.length ? params : ["input"];
  const client = `// SuperBlue relocate — THIN CLIENT (no secret logic). Review before ship.
const API = ${JSON.stringify(apiBase)};
let _token = null;

export async function activate(licenseKey, deviceId = "device-1") {
  const r = await fetch(API + "/activate", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ licenseKey, deviceId }) });
  const j = await r.json();
  if (!r.ok) return { ok: false, reason: j.error };
  _token = j.token;
  return { ok: true };
}

/** Former export \`${exportName}\` — now server-side only. */
export async function ${exportName}(${argNames.join(", ")}) {
  const r = await fetch(API + "/rpc/${exportName}", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: _token, args: [${argNames.join(", ")}] }) });
  const j = await r.json();
  if (!r.ok) return { ok: false, reason: j.error || j.reason };
  return { ok: true, result: j.result };
}
`;

  const server = `// SuperBlue relocate — SERVER SKELETON. Paste your REAL logic into run_${exportName}().
// Wire to server-lock (../server-lock/) for auth, attestation, and forensics.
import http from "node:http";
// import { mint, verifyToken } from "./token.mjs"; // from server-lock

function run_${exportName}(${argNames.join(", ")}) {
  // TODO: MOVE BODY OF FORMER CLIENT \`${exportName}\` HERE — secret/constants never ship.
  throw new Error("implement ${exportName} on the server");
}

const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/rpc/${exportName}") {
    let body = ""; req.on("data", (c) => body += c); await new Promise((r) => req.on("end", r));
    try {
      const { token, args } = JSON.parse(body || "{}");
      if (!token) return json(res, 401, { error: "unauthorized" });
      // verify token (server-lock)
      const result = run_${exportName}(...args);
      return json(res, 200, { result });
    } catch (e) { return json(res, 500, { error: String(e.message) }); }
  }
  json(res, 404, { error: "not-found" });
}).listen(process.env.PORT || 8787, () => console.log("${product} authority on :" + (process.env.PORT || 8787)));
`;

  return { client, server, exportName, argNames };
}

export function relocateFromFile(inPath, outDir, opts = {}) {
  const src = readFileSync(inPath, "utf8");
  const parsed = parseSimpleExport(src);
  if (!parsed) throw new Error("could not find a simple export function/const in " + inPath);
  mkdirSync(outDir, { recursive: true });
  const gen = generateRelocate({ ...parsed, ...opts, product: opts.product || basename(inPath) });
  const clientPath = join(outDir, `${parsed.name}.client.mjs`);
  const serverPath = join(outDir, `${parsed.name}.server.mjs`);
  const notePath = join(outDir, "RELOCATE-NOTES.md");
  writeFileSync(clientPath, gen.client);
  writeFileSync(serverPath, gen.server);
  writeFileSync(notePath, `# Relocate output\n\n- Moved export **${parsed.name}** off-client.\n- Implement \`run_${parsed.name}\` in the server file with logic from \`${basename(inPath)}\`.\n- Prefer \`server-lock/\` for tokens and attestation.\n- Run \`superblue scan\` on the **client only** before ship.\n`);
  return { clientPath, serverPath, notePath, exportName: parsed.name };
}