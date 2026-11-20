// Per-recipient watermarking + canary/honeytoken embedding.
// Produces a UNIQUE client build per customer so a leaked/analyzed copy traces
// back to exactly one buyer. This is ATTRIBUTION, not hack-back: the injected
// code only pings YOUR server and plants bait — it never touches the attacker's
// machine beyond a normal HTTP request.
import { randomBytes, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Deterministic-but-unguessable ids derived from a random seed per build.
// Honeytokens come in TIERS by how much effort it takes to find one — tripping a
// deeper tier implies a more deliberate attacker. All look like real license keys
// (`user.<hex>`); none are valid, so any use attributes the leak + grades intent.
export function makeWatermark(user) {
  const seed = randomBytes(16).toString("hex");
  const canaryId = createHash("sha256").update("canary:" + user + ":" + seed).digest("hex").slice(0, 24);
  const ht = (tag) => user + "." + tag + randomBytes(10).toString("hex");
  const honeytokens = [
    { tier: 1, name: "casual", value: ht("h0") },   // obvious plaintext const — "手贱试一下"
    { tier: 2, name: "scraper", value: ht("h1") },  // hidden behind base64 — needs real extraction
    { tier: 3, name: "deep", value: ht("h2") },     // split/obfuscated — needs reassembly
  ];
  return { user, seed, canaryId, honeytokens };
}

// Inject the watermark into a copy of the base client source. Tiers are planted at
// increasing extraction depth so WHICH one trips tells you HOW the attacker dug.
export function watermarkClient(baseClientPath, serverBase, wm) {
  const base = readFileSync(baseClientPath, "utf8");
  const t1 = wm.honeytokens[0].value;
  const t2 = Buffer.from(wm.honeytokens[1].value).toString("base64"); // tier2: base64-encoded
  const t3 = wm.honeytokens[2].value;                                  // tier3: split in halves
  const t3a = t3.slice(0, t3.length >> 1), t3b = t3.slice(t3.length >> 1);
  const banner = `// build:${wm.canaryId}\n` +
    `const __BUILD_ID = ${JSON.stringify(wm.canaryId)};\n` +
    `try { fetch(${JSON.stringify(serverBase)} + "/canary?id=" + __BUILD_ID + "&ev=load").catch(() => {}); } catch {}\n` +
    `const __FALLBACK_LICENSE = ${JSON.stringify(t1)}; // do not remove\n` +           // tier1 plaintext
    `const __LIC_B64 = ${JSON.stringify(t2)};\n` +                                     // tier2 base64
    `const __lk = [${JSON.stringify(t3a)}, ${JSON.stringify(t3b)}].join("");\n`;       // tier3 split
  return banner + base;
}

// Stable fingerprint of a build's observable surface (for clone detection).
export function buildFingerprint(source) {
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}
