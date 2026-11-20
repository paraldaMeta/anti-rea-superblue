// REAShield-inspired L1 scaffold: move valuable logic server-side, ship only RPC.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { basename, join, relative, dirname, resolve } from "node:path";
import { extractExportedFunction } from "./extract-fn.mjs";

export function parseSimpleExport(source) {
  const fn = source.match(/export\s+function\s+(\w+)\s*\(([^)]*)\)/);
  if (fn) return { name: fn[1], params: fn[2].split(",").map((s) => s.trim()).filter(Boolean) };
  const constFn = source.match(/export\s+const\s+(\w+)\s*=/);
  if (constFn) return { name: constFn[1], params: ["input"] };
  const def = source.match(/export\s+default\s+function\s+(\w+)?\s*\(([^)]*)\)/);
  if (def) return { name: def[1] || "default", params: (def[2] || "").split(",").map((s) => s.trim()).filter(Boolean) };
  return null;
}

function serverLockPaths(outDir, serverLockRoot) {
  const clientFile = join(serverLockRoot, "src/client.mjs");
  let relClient = relative(outDir, clientFile).replace(/\\/g, "/");
  // /tmp or other out-of-tree --out: fall back to standard monorepo layout (relocate-out → server-lock)
  const canonicalOut = join(serverLockRoot, "..", "relocate-out");
  if (!relClient.startsWith(".") || relClient.split("/").length > 8) {
    relClient = relative(canonicalOut, clientFile).replace(/\\/g, "/");
  }
  const relLock = relative(outDir, serverLockRoot).replace(/\\/g, "/") || "../server-lock";
  return {
    client: relClient,
    serverLogic: `${relLock}/src/logic-relocated.mjs`,
    serverEntry: `${relLock}/src/server-relocated.mjs`,
  };
}

export function generateRelocate({ exportName, params, apiBase, product, body, serverLock }) {
  const argNames = params.length ? params : ["input"];

  if (serverLock) {
    const client = `// SuperBlue relocate + server-lock thin client
import { makeClient } from ${JSON.stringify(serverLock.client)};
const client = makeClient(${JSON.stringify(apiBase)});
export const activate = (...a) => client.activate(...a);
export const isLicensed = () => client.isLicensed();
export async function ${exportName}(...args) {
  const input = args[0];
  return client.premium(typeof input === "string" ? input : JSON.stringify(args));
}
`;
    const logic = `// Server-only logic (relocated from client). Secrets/constants live here only.
export function ${exportName}(${argNames.join(", ")}) {
${body ? body.split("\n").map((l) => "  " + l).join("\n") : "  throw new Error('empty body');"}
}
`;
    const serverEntry = `// Starts server-lock authority with relocated premium logic.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.mjs";
import { ${exportName} } from "./logic-relocated.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Patch: replace premiumTransform in-process by wrapping createServer handler (see server-relocated-bootstrap).
import { premiumTransform as orig } from "./server-bootstrap-relocated.mjs";
export { orig as premiumTransform };
`;
    return { client, logic, serverEntry, exportName, argNames, mode: "server-lock" };
  }

  const client = `// SuperBlue relocate — THIN CLIENT
const API = ${JSON.stringify(apiBase)};
let _token = null;
export async function activate(licenseKey, deviceId = "device-1") {
  const r = await fetch(API + "/activate", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ licenseKey, deviceId }) });
  const j = await r.json();
  if (!r.ok) return { ok: false, reason: j.error };
  _token = j.token; return { ok: true };
}
export async function ${exportName}(${argNames.join(", ")}) {
  const r = await fetch(API + "/rpc/${exportName}", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: _token, args: [${argNames.join(", ")}] }) });
  const j = await r.json();
  if (!r.ok) return { ok: false, reason: j.error || j.reason };
  return { ok: true, result: j.result };
}
`;
  const server = `// Server skeleton with relocated body
function run_${exportName}(${argNames.join(", ")}) {
${body ? body.split("\n").map((l) => "  " + l).join("\n") : "  throw new Error('implement');"}
}
import http from "node:http";
const json = (r, c, o) => { r.writeHead(c, { "content-type": "application/json" }); r.end(JSON.stringify(o)); };
http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/rpc/${exportName}") {
    let b = ""; req.on("data", (c) => b += c); await new Promise((r) => req.on("end", r));
    const { token, args } = JSON.parse(b || "{}");
    if (!token) return json(res, 401, { error: "unauthorized" });
    return json(res, 200, { result: run_${exportName}(...args) });
  }
  json(res, 404, { error: "not-found" });
}).listen(process.env.PORT || 8787);
`;
  return { client, server, exportName, argNames, mode: "skeleton" };
}

export function relocateFromFile(inPath, outDir, opts = {}) {
  const src = readFileSync(inPath, "utf8");
  const parsed = parseSimpleExport(src);
  if (!parsed) throw new Error("could not find export function in " + inPath);
  const extracted = extractExportedFunction(src, parsed.name);
  const body = extracted?.body || null;
  const params = extracted?.params?.length ? extracted.params : parsed.params;
  mkdirSync(outDir, { recursive: true });

  const serverLockRoot = resolve(opts.serverLockRoot || join(outDir, "..", "server-lock"));
  const gen = generateRelocate({
    exportName: parsed.name,
    params,
    apiBase: opts.apiBase || "http://localhost:8787",
    product: opts.product || basename(inPath),
    body,
    serverLock: opts.serverLock ? serverLockPaths(outDir, serverLockRoot) : null,
  });

  const clientPath = join(outDir, `${parsed.name}.client.mjs`);
  writeFileSync(clientPath, gen.client);

  if (gen.mode === "server-lock") {
    const logicPath = join(serverLockRoot, "src", "logic-relocated.mjs");
    mkdirSync(dirname(logicPath), { recursive: true });
    writeFileSync(logicPath, gen.logic);
    writeFileSync(join(outDir, "SERVER-LOCK.md"), [
      "# server-lock integration",
      "",
      `Logic written to \`${logicPath}\`.`,
      "`premiumTransform` in `server.mjs` loads it via `relocate-bridge.mjs` when present.",
      "",
      `1. \`cd server-lock && node src/keygen.mjs\``,
      "2. \`node src/server.mjs\` — authority on :8787",
      `3. Ship only \`${basename(clientPath)}\` (SuperBlue \`scan\` first)`,
      "",
      "Extracted body bytes: " + (body?.length || 0),
    ].join("\n"));
  } else {
    const serverPath = join(outDir, `${parsed.name}.server.mjs`);
    writeFileSync(serverPath, gen.server);
  }

  const notePath = join(outDir, "RELOCATE-NOTES.md");
  writeFileSync(notePath, [
    `# Relocate: ${parsed.name}`,
    "",
    `- Body extracted: **${body ? "yes (" + body.length + " chars)" : "no — fill manually"}**`,
    `- Mode: **${gen.mode}**`,
    "- Run `superblue scan` on client before ship.",
  ].join("\n"));

  const serverPath =
    gen.mode === "server-lock"
      ? join(serverLockRoot, "src", "logic-relocated.mjs")
      : join(outDir, `${parsed.name}.server.mjs`);
  return { clientPath, serverPath, notePath, exportName: parsed.name, bodyExtracted: !!body, mode: gen.mode };
}