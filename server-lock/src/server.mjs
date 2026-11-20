// The authority. Holds the private key + server secret + the VALUABLE LOGIC.
// None of these ever ship to a client. This is the L1 "real lock":
//   - license validation happens here (attacker can't forge keys without the secret)
//   - tokens are signed here (attacker can't forge a license without the private key)
//   - the premium computation RUNS here (cloning the client yields no capability)
// Plus ATTRIBUTION (legal): per-build canaries, honeytokens, server-side telemetry,
// anomaly detection, and revocation. No hack-back — detection + evidence only.
import http from "node:http";
import { createHmac, createHash, timingSafeEqual, randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mint, verifyToken } from "./token.mjs";
import { hwFingerprint, verifyAttestation } from "./attestation.mjs";
import { signReport } from "./report.mjs";
import { premiumViaRelocated } from "./relocate-bridge.mjs";
import { TOKEN_TTL_MS, CHALLENGE_TTL_MS, THREAT_THRESHOLD, STRENGTH_TIER } from "./config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_PEM = readFileSync(join(root, "secrets", "signing-private.pem"), "utf8");
const PUBLIC_PEM = readFileSync(join(root, "client-dist", "public-key.pem"), "utf8");
const SERVER_SECRET = readFileSync(join(root, "secrets", "server-secret.txt"), "utf8").trim();
// TOKEN_TTL_MS, CHALLENGE_TTL_MS, THREAT_THRESHOLD — see config.mjs (STRENGTH_TIER=8 defaults)

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
async function premiumTransform(input) {
  const relocated = await premiumViaRelocated(input);
  if (relocated != null) return relocated;
  let acc = 0x9e3779b9 >>> 0;
  for (const ch of String(input)) acc = ((acc ^ ch.charCodeAt(0)) * 0x01000193) >>> 0;
  return `SECRET(${input})=${acc.toString(16).padStart(8, "0")}`;
}

// ---- attribution / active-defense state (in-memory; use a DB in production) ----
const state = {
  events: [],                 // append-only audit log
  revokedJti: new Set(),      // revoked token ids
  revokedUser: new Set(),     // revoked users (kill switch)
  honeytokens: new Map(),     // honeytoken -> { user, tier, name }
  canaries: new Map(),        // canaryId -> { user }
  tokenDevices: new Map(),    // jti -> Set(deviceFingerprint)  (sharing detection)
  flags: new Map(),           // user -> [reasons]  (burned / attacker-attributed)
  attemptsByIp: new Map(),    // ip -> [timestamps]  (batch/automation detection)
  lastGeoByUser: new Map(),   // user -> { t, lat, lon }  (impossible-travel)
  challenges: new Map(),      // nonce -> expiry  (one-time attestation challenges)
  devices: new Map(),         // hwfp -> attestationPubKeyB64  (registered secure elements)
  scoreByUser: new Map(),     // user -> cumulative threat score
};
const log = (kind, o) => { const e = { t: Date.now(), kind, ...o }; state.events.push(e); return e; };
const flag = (user, reason) => { if (!user) return; const a = state.flags.get(user) || []; if (!a.includes(reason)) a.push(reason); state.flags.set(user, a); };

// Cumulative threat scoring with automatic revocation above a configurable line.
function addScore(user, pts, reason) {
  if (!user) return;
  const next = (state.scoreByUser.get(user) || 0) + pts;
  state.scoreByUser.set(user, next);
  log("threat.score", { user, added: pts, total: next, reason });
  if (next >= THREAT_THRESHOLD && !state.revokedUser.has(user)) {
    state.revokedUser.add(user);
    flag(user, `AUTO-BANNED: threat score ${next} ≥ ${THREAT_THRESHOLD} (last: ${reason})`);
    log("autoban", { user, score: next });
  }
}

// One-time challenge lifecycle (proof-of-possession).
function issueChallenge() { const n = randomBytes(24).toString("hex"); state.challenges.set(n, Date.now() + CHALLENGE_TTL_MS); return n; }
function consumeChallenge(n) {
  const exp = state.challenges.get(n);
  if (!exp) return false;
  state.challenges.delete(n); // one-time use (anti-replay)
  return Date.now() <= exp;
}

// Behavioural velocity: how many bad/decoy attempts from this ip in the last 60s.
function recordAttempt(ip) {
  const now = Date.now(); const arr = (state.attemptsByIp.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now); state.attemptsByIp.set(ip, arr); return arr.length;
}

// Grade attacker intent from decoy tier + behaviour. Tier = how deep they dug;
// velocity = whether it's a human poking or an automated harvester.
function gradeHoneytoken(tier, velocity) {
  if (velocity >= 5) return { level: "high", intent: "automated/batch harvesting", score: 90 };
  if (tier >= 3) return { level: "high", intent: "deliberate deep extraction (reassembled a split key)", score: 80 };
  if (tier === 2) return { level: "medium", intent: "real extraction (decoded an obfuscated key)", score: 55 };
  return { level: "low", intent: "casual probing (tried an obvious plaintext key)", score: 25 };
}

function resolveGeo(req) {
  const h = req.headers["x-geo"]; if (!h) return null;
  const [lat, lon] = String(h).split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}
function haversineKm(a, b) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLon = toR(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Impossible travel: implied speed between two same-user locations exceeds a jet.
function checkImpossibleTravel(user, geo, now) {
  if (!geo) return null;
  const prev = state.lastGeoByUser.get(user);
  state.lastGeoByUser.set(user, { t: now, ...geo });
  if (!prev) return null;
  const hours = Math.max((now - prev.t) / 3.6e6, 1 / 3600); // >= 1s
  const km = haversineKm(prev, geo);
  const kmh = km / hours;
  if (km > 50 && kmh > 900) return { km: Math.round(km), kmh: Math.round(kmh) };
  return null;
}

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

    // One-time challenge for hardware proof-of-possession.
    if (req.method === "GET" && url.pathname === "/challenge") {
      return json(res, 200, { challenge: issueChallenge(), ttlMs: CHALLENGE_TTL_MS });
    }

    // Vendor-side: register a per-recipient watermarked build (canary + honeytoken).
    if (req.method === "POST" && url.pathname === "/register-build") {
      const { user, canaryId, honeytokens } = await body(req);
      if (canaryId) state.canaries.set(canaryId, { user });
      for (const h of honeytokens || []) state.honeytokens.set(h.value, { user, tier: h.tier, name: h.name });
      log("build.registered", { user, canaryId, tiers: (honeytokens || []).length });
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
      const { licenseKey, deviceId, attestationPubKey, challenge, challengeSig } = await body(req);

      // Honeytoken trap: a legit user NEVER has this. Presenting it = scraped the binary.
      if (state.honeytokens.has(licenseKey)) {
        const { user: owner, tier, name } = state.honeytokens.get(licenseKey);
        const velocity = recordAttempt(meta.ip);
        const grade = gradeHoneytoken(tier, velocity);
        log("honeytoken.tripped", { plantedIn: owner, tier, tierName: name, velocity, grade: grade.level, ...meta });
        flag(owner, `honeytoken T${tier}(${name}) tripped from ip=${meta.ip} — [${grade.level}] ${grade.intent} (velocity=${velocity}/min)`);
        addScore(owner, grade.score, `honeytoken-T${tier}`);
        return json(res, 403, { error: "invalid-license" }); // look identical to a normal failure
      }

      const userId = validLicense(licenseKey);
      if (!userId) { recordAttempt(meta.ip); log("activate.denied", { ...meta }); return json(res, 403, { error: "invalid-license" }); }
      if (state.revokedUser.has(userId)) { log("activate.revoked-user", { user: userId, ...meta }); return json(res, 403, { error: "revoked" }); }

      // Hardware attestation: prove possession of a non-exportable secure-element key.
      if (!attestationPubKey || !verifyAttestation(challenge, attestationPubKey, challengeSig) || !consumeChallenge(challenge)) {
        log("activate.attestation-failed", { user: userId, ...meta });
        return json(res, 401, { error: "attestation-failed" });
      }
      const hwfp = hwFingerprint(attestationPubKey);
      state.devices.set(hwfp, attestationPubKey); // register this secure element

      const jti = randomUUID();
      const token = mint({ jti, sub: deviceId || "unbound", hwfp, user: userId, scope: "premium", iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS }, PRIVATE_PEM);
      log("activate.ok", { user: userId, jti, device: deviceId, hwfp, ...meta });
      return json(res, 200, { token, expiresInMs: TOKEN_TTL_MS });
    }

    // Gated capability: value produced HERE, with revocation + anomaly detection.
    if (req.method === "POST" && url.pathname === "/premium") {
      const { token, input, challenge, challengeSig } = await body(req);
      const v = verifyToken(token, PUBLIC_PEM);
      if (!v.ok || v.claims.scope !== "premium") { log("premium.unauthorized", { reason: v.reason, ...meta }); return json(res, 401, { error: "unauthorized", reason: v.reason }); }
      const { jti, user, hwfp } = v.claims;

      // Revocation (kill switch) — stateless tokens made revocable server-side.
      if (state.revokedJti.has(jti) || state.revokedUser.has(user)) { log("premium.revoked", { user, jti, ...meta }); return json(res, 403, { error: "revoked" }); }

      // HARDWARE proof-of-possession (enforced): the caller must sign a fresh one-time
      // challenge with the secure-element key the token is bound to. A copied token on
      // another machine CANNOT sign (the private key never left the enclave) -> denied.
      const boundPub = state.devices.get(hwfp);
      const popOk = boundPub && verifyAttestation(challenge, boundPub, challengeSig) && consumeChallenge(challenge);
      if (!popOk) {
        flag(user, `proof-of-possession failed: token bound to secure-element ${hwfp} presented without its hardware key (ip=${meta.ip}) — copied/stolen token, DENIED`);
        log("anomaly.pop-failed", { user, jti, hwfp, ...meta });
        addScore(user, 60, "pop-failed");
        return json(res, 403, { error: "device-not-authorized" });
      }

      // Token-sharing telemetry: one token observed from many device identities.
      const fp = meta.dev || hwfp;
      const set = state.tokenDevices.get(jti) || new Set();
      set.add(fp); state.tokenDevices.set(jti, set);
      if (set.size > 1) {
        flag(user, `token seen on ${set.size} device fingerprints (${[...set].join(", ")}) — key sharing / cloned client`);
        log("anomaly.token-sharing", { user, jti, devices: [...set], ...meta });
        addScore(user, 40, "token-sharing");
      }

      // Impossible-travel: same user active from two places faster than a jet.
      const it = checkImpossibleTravel(user, resolveGeo(req), Date.now());
      if (it) {
        flag(user, `impossible travel: ${it.km}km in moments (~${it.kmh}km/h) — account used from two locations, likely shared/stolen`);
        log("anomaly.impossible-travel", { user, jti, ...it, ...meta });
        addScore(user, 70, "impossible-travel");
      }

      // A ban may have just fired mid-request.
      if (state.revokedUser.has(user)) return json(res, 403, { error: "revoked" });

      log("premium.ok", { user, jti, ...meta });
      const result = await premiumTransform(input);
      return json(res, 200, { result, servedTo: user });
    }

    // Revoke (vendor action): kill a token or a whole user.
    if (req.method === "POST" && url.pathname === "/revoke") {
      const { jti, user } = await body(req);
      if (jti) state.revokedJti.add(jti);
      if (user) state.revokedUser.add(user);
      log("revoke", { jti, user });
      return json(res, 200, { ok: true });
    }

    // Forensics: SIGNED attribution report for a user (tamper-evident evidence trail).
    if (req.method === "GET" && url.pathname === "/forensics") {
      const user = url.searchParams.get("user");
      const evts = state.events.filter((e) => e.user === user || e.plantedIn === user);
      const report = {
        user,
        threatScore: state.scoreByUser.get(user) || 0,
        threatThreshold: THREAT_THRESHOLD,
        burned: (state.flags.get(user) || []).length > 0,
        revoked: state.revokedUser.has(user),
        autoBanned: evts.some((e) => e.kind === "autoban"),
        flags: state.flags.get(user) || [],
        eventCount: evts.length,
        events: evts.slice(-50),
        generatedAt: new Date().toISOString(),
      };
      return json(res, 200, signReport(report, PRIVATE_PEM)); // Ed25519-signed envelope
    }

    json(res, 404, { error: "not-found" });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`🔐 authority+attribution listening on http://localhost:${port}`));
}
