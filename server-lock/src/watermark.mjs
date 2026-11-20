// Per-recipient watermarking + canary/honeytoken embedding.
// Produces a UNIQUE client build per customer so a leaked/analyzed copy traces
// back to exactly one buyer. This is ATTRIBUTION, not hack-back: the injected
// code only pings YOUR server and plants bait — it never touches the attacker's
// machine beyond a normal HTTP request.
import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Deterministic-but-unguessable ids derived from a random seed per build.
export function makeWatermark(user) {
  const seed = randomBytes(16).toString("hex");
  const canaryId = createHash("sha256").update("canary:" + user + ":" + seed).digest("hex").slice(0, 24);
  // A honeytoken: looks EXACTLY like a real license key (`user.<24hex>`) so an
  // attacker scraping the binary will find it and try it — but it is invalid.
  // No legitimate user ever presents it, so any activation attempt = attacker.
  const honeytoken = user + ".h0" + randomBytes(11).toString("hex");
  return { user, seed, canaryId, honeytoken };
}

// Inject the watermark into a copy of the base client source.
export function watermarkClient(baseClientPath, serverBase, wm) {
  const base = readFileSync(baseClientPath, "utf8");
  const banner = `// build:${wm.canaryId}\n` +
    `const __BUILD_ID = ${JSON.stringify(wm.canaryId)};\n` +
    // beacon: fires when this build is LOADED/RUN (incl. inside an analysis sandbox).
    // Network-isolated static analysis defeats it — treat a hit as a strong signal,
    // not a guarantee. The reliable attribution is server-side telemetry (see server).
    `try { fetch(${JSON.stringify(serverBase)} + "/canary?id=" + __BUILD_ID + "&ev=load").catch(() => {}); } catch {}\n` +
    // honeytoken bait, disguised as a hardcoded fallback license:
    `const __FALLBACK_LICENSE = ${JSON.stringify(wm.honeytoken)}; // do not remove\n`;
  return banner + base;
}

// Stable fingerprint of a build's observable surface (for clone detection).
export function buildFingerprint(source) {
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}
