// The authority. Holds the private key + server secret + the VALUABLE LOGIC.
// None of these ever ship to a client. This is the L1 "real lock":
//   - license validation happens here (attacker can't forge keys without the secret)
//   - tokens are signed here (attacker can't forge a license without the private key)
//   - the premium computation RUNS here (cloning the client yields no capability)
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mint, verifyToken } from "./token.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_PEM = readFileSync(join(root, "secrets", "signing-private.pem"), "utf8");
const PUBLIC_PEM = readFileSync(join(root, "client-dist", "public-key.pem"), "utf8");
const SERVER_SECRET = readFileSync(join(root, "secrets", "server-secret.txt"), "utf8").trim();
const TOKEN_TTL_MS = 10 * 60 * 1000; // short-lived; forces periodic re-auth

// ---- server-only license logic (vendor issues keys; attacker can't mint them) ----
function keyFor(userId) {
  const mac = createHmac("sha256", SERVER_SECRET).update(userId).digest("hex").slice(0, 24);
  return `${userId}.${mac}`;
}
function validLicense(licenseKey) {
  const i = String(licenseKey).lastIndexOf(".");
  if (i < 0) return null;
  const userId = licenseKey.slice(0, i);
  const expect = keyFor(userId);
  const a = Buffer.from(licenseKey), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

// ---- the VALUABLE computation the product sells. Never leaves the server. ----
function premiumTransform(input) {
  // (stand-in for real IP: a model call, a proprietary algorithm, licensed data…)
  let acc = 0x9e3779b9 >>> 0;
  for (const ch of String(input)) acc = ((acc ^ ch.charCodeAt(0)) * 0x01000193) >>> 0;
  return `SECRET(${input})=${acc.toString(16).padStart(8, "0")}`;
}

function body(req) {
  return new Promise((res) => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}
const json = (r, code, obj) => { r.writeHead(code, { "content-type": "application/json" }); r.end(JSON.stringify(obj)); };

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    // Vendor-side helper (in reality this is your billing system, not public):
    if (req.method === "GET" && url.pathname === "/issue") {
      return json(res, 200, { licenseKey: keyFor(url.searchParams.get("user") || "anon") });
    }

    // Activation: license -> short-lived token bound to a device.
    if (req.method === "POST" && url.pathname === "/activate") {
      const { licenseKey, deviceId } = await body(req);
      const userId = validLicense(licenseKey);
      if (!userId) return json(res, 403, { error: "invalid-license" });
      const token = mint({ sub: deviceId || "unbound", user: userId, scope: "premium", iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS }, PRIVATE_PEM);
      return json(res, 200, { token, expiresInMs: TOKEN_TTL_MS, publicKeyHint: "verify offline with shipped public-key.pem" });
    }

    // Gated capability: the value is produced HERE, only for valid tokens.
    if (req.method === "POST" && url.pathname === "/premium") {
      const { token, input } = await body(req);
      const v = verifyToken(token, PUBLIC_PEM);
      if (!v.ok || v.claims.scope !== "premium") return json(res, 401, { error: "unauthorized", reason: v.reason });
      return json(res, 200, { result: premiumTransform(input), servedTo: v.claims.user });
    }

    json(res, 404, { error: "not-found" });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`🔐 authority listening on http://localhost:${port}`));
}
