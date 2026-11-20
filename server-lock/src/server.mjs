// The authority. Holds the private key + server secret + the VALUABLE LOGIC.
// None of these ever ship to a client. This is the L1 "real lock":
//   - license validation happens here (attacker can't forge keys without the secret)
//   - tokens are signed here (attacker can't forge a license without the private key)
//   - the premium computation RUNS here (cloning the client yields no capability)
// Plus ATTRIBUTION (legal): per-build canaries, honeytokens, server-side telemetry,
// anomaly detection, and revocation. No hack-back — detection + evidence only.
import http from "node:http";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mint, verifyToken } from "./token.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_PEM = readFileSync(join(root, "secrets", "signing-private.pem"), "utf8");
const PUBLIC_PEM = readFileSync(join(root, "client-dist", "public-key.pem"), "utf8");
const SERVER_SECRET = readFileSync(join(root, "secrets", "server-secret.txt"), "utf8").trim();
const TOKEN_TTL_MS = 10 * 60 * 1000;

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
  let acc = 0x9e3779b9 >>> 0;
  for (const ch of String(input)) acc = ((acc ^ ch.charCodeAt(0)) * 0x01000193) >>> 0;
  return `SECRET(${input})=${acc.toString(16).padStart(8, "0")}`;
}

// ---- attribution / active-defense state (in-memory; use a DB in production) ----
const state = {
  events: [],                 // append-only audit log
  revokedJti: new Set(),      // revoked token ids
  revokedUser: new Set(),     // revoked users (kill switch)
  honeytokens: new Map(),     // honeytoken -> user it was planted in
  canaries: new Map(),        // canaryId -> { user }
  tokenDevices: new Map(),    // jti -> Set(deviceFingerprint)  (sharing detection)
  flags: new Map(),           // user -> [reasons]  (burned / attacker-attributed)
};
const log = (kind, o) => { const e = { t: Date.now(), kind, ...o }; state.events.push(e); return e; };
const flag = (user, reason) => { if (!user) return; const a = state.flags.get(user) || []; if (!a.includes(reason)) a.push(reason); state.flags.set(user, a); };

function body(req) {
  return new Promise((res) => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } }); });
}
const json = (r, code, obj) => { r.writeHead(code, { "content-type": "application/json" }); r.end(JSON.stringify(obj)); };
const clientMeta = (req) => ({ ip: req.socket.remoteAddress, ua: req.headers["user-agent"] || "", dev: req.headers["x-device"] || "" });

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const meta = clientMeta(req);

    // Vendor-side: issue a real license key.
    if (req.method === "GET" && url.pathname === "/issue") {
      return json(res, 200, { licenseKey: keyFor(url.searchParams.get("user") || "anon") });
    }

    // Vendor-side: register a per-recipient watermarked build (canary + honeytoken).
    if (req.method === "POST" && url.pathname === "/register-build") {
      const { user, canaryId, honeytoken } = await body(req);
      if (canaryId) state.canaries.set(canaryId, { user });
      if (honeytoken) state.honeytokens.set(honeytoken, user);
      log("build.registered", { user, canaryId });
      return json(res, 200, { ok: true });
    }

    // Canary beacon: the watermarked build was loaded/run somewhere.
    if (req.method === "GET" && url.pathname === "/canary") {
      const id = url.searchParams.get("id");
      const rec = state.canaries.get(id);
      const ev = log("canary.hit", { canaryId: id, user: rec?.user, ...meta, raw: url.searchParams.get("ev") });
      if (rec?.user) flag(rec.user, "canary-beacon-fired (build loaded in an un-isolated environment)");
      // return a harmless 1x1 so it can be embedded anywhere; no payload to the client.
      res.writeHead(200, { "content-type": "image/gif" });
      return res.end(Buffer.from("R0lGODlhAQABAAAAACwAAAAAAQABAAA=", "base64"));
    }

    // Activation: license -> short-lived, revocable, device-bound token.
    if (req.method === "POST" && url.pathname === "/activate") {
      const { licenseKey, deviceId } = await body(req);

      // Honeytoken trap: a legit user NEVER has this. Presenting it = scraped the binary.
      if (state.honeytokens.has(licenseKey)) {
        const owner = state.honeytokens.get(licenseKey);
        log("honeytoken.tripped", { plantedIn: owner, ...meta });
        flag(owner, `honeytoken tripped from ip=${meta.ip} — this build's binary was scraped by an attacker`);
        return json(res, 403, { error: "invalid-license" }); // look identical to a normal failure
      }

      const userId = validLicense(licenseKey);
      if (!userId) { log("activate.denied", { ...meta }); return json(res, 403, { error: "invalid-license" }); }
      if (state.revokedUser.has(userId)) { log("activate.revoked-user", { user: userId, ...meta }); return json(res, 403, { error: "revoked" }); }

      const jti = randomUUID();
      const token = mint({ jti, sub: deviceId || "unbound", user: userId, scope: "premium", iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS }, PRIVATE_PEM);
      log("activate.ok", { user: userId, jti, device: deviceId, ...meta });
      return json(res, 200, { token, expiresInMs: TOKEN_TTL_MS });
    }

    // Gated capability: value produced HERE, with revocation + anomaly detection.
    if (req.method === "POST" && url.pathname === "/premium") {
      const { token, input } = await body(req);
      const v = verifyToken(token, PUBLIC_PEM);
      if (!v.ok || v.claims.scope !== "premium") { log("premium.unauthorized", { reason: v.reason, ...meta }); return json(res, 401, { error: "unauthorized", reason: v.reason }); }
      const { jti, user, sub } = v.claims;

      // Revocation (kill switch) — stateless tokens made revocable server-side.
      if (state.revokedJti.has(jti) || state.revokedUser.has(user)) { log("premium.revoked", { user, jti, ...meta }); return json(res, 403, { error: "revoked" }); }

      // Token-sharing / cloned-client detection: one token, many device fingerprints.
      const fp = meta.dev || sub;
      const set = state.tokenDevices.get(jti) || new Set();
      set.add(fp); state.tokenDevices.set(jti, set);
      if (set.size > 1) {
        flag(user, `token shared across ${set.size} device fingerprints (${[...set].join(", ")}) — likely cloned client / key sharing`);
        log("anomaly.token-sharing", { user, jti, devices: [...set], ...meta });
      }

      log("premium.ok", { user, jti, ...meta });
      return json(res, 200, { result: premiumTransform(input), servedTo: user });
    }

    // Revoke (vendor action): kill a token or a whole user.
    if (req.method === "POST" && url.pathname === "/revoke") {
      const { jti, user } = await body(req);
      if (jti) state.revokedJti.add(jti);
      if (user) state.revokedUser.add(user);
      log("revoke", { jti, user });
      return json(res, 200, { ok: true });
    }

    // Forensics: attribution report for a user (the evidence trail for legal action).
    if (req.method === "GET" && url.pathname === "/forensics") {
      const user = url.searchParams.get("user");
      const evts = state.events.filter((e) => e.user === user || e.plantedIn === user);
      return json(res, 200, {
        user,
        flags: state.flags.get(user) || [],
        burned: (state.flags.get(user) || []).length > 0,
        revoked: state.revokedUser.has(user),
        eventCount: evts.length,
        events: evts.slice(-50),
      });
    }

    json(res, 404, { error: "not-found" });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`🔐 authority+attribution listening on http://localhost:${port}`));
}
