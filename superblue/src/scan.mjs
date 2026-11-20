// SuperBlue L0 — Containment scanner.
// Finds information an AI agent (REA-class) can lift for free: source maps,
// secrets/keys, dev/debug leftovers, VCS/env files. This layer is the
// load-bearing, PERMANENT one: a removed leak cannot be "un-raised" like a
// tarpit budget. Honest by design — reports severity, never "safe".
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname, basename, relative } from "node:path";

const SEV = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };

// High-signal secret patterns (prefix-anchored to keep false positives low).
const SECRET_PATTERNS = [
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id", SEV.CRITICAL],
  [/\bASIA[0-9A-Z]{16}\b/, "AWS temp access key id", SEV.CRITICAL],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, "private key block", SEV.CRITICAL],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "GitHub token", SEV.CRITICAL],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, "Slack token", SEV.CRITICAL],
  [/\bsk-[A-Za-z0-9]{20,}\b/, "OpenAI-style secret key", SEV.CRITICAL],
  [/\bsk_live_[A-Za-z0-9]{10,}\b/, "Stripe live secret key", SEV.CRITICAL],
  [/\bsk_test_[A-Za-z0-9]{10,}\b/, "Stripe test secret key", SEV.HIGH],
  [/\brk_live_[A-Za-z0-9]{10,}\b/, "Stripe restricted live key", SEV.CRITICAL],
  [/\bgsk_[A-Za-z0-9]{20,}\b/, "Groq API key", SEV.CRITICAL],
  [/\bsk-or-v1-[0-9a-f]{32,}\b/, "OpenRouter key", SEV.CRITICAL],
  [/\bpplx-[A-Za-z0-9]{20,}\b/, "Perplexity API key", SEV.HIGH],
  [/\bDiscord\s+Bot\s+Token|discord(?:app)?\.com\/api\/webhooks\/\d+\//i, "Discord bot/webhook material", SEV.HIGH],
  [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^\s"']{8,}:[^\s"']{4,}@[^\s"']+/i, "database connection string with password", SEV.CRITICAL],
  [/\bAIza[0-9A-Za-z\-_]{35}\b/, "Google API key", SEV.HIGH],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, "JWT", SEV.HIGH],
  [/\b(?:api[_-]?key|secret|passwd|password|token|private[_-]?key)\b\s*[:=]\s*["'][^"']{8,}["']/i, "hardcoded credential assignment", SEV.HIGH],
];

const DEV_MARKERS = [
  [/\bdebugger\b\s*;/, "debugger statement", SEV.MODERATE],
  [/\bconsole\.(?:debug|trace)\b/, "debug console call", SEV.MODERATE],
  [/__webpack_require__|webpackChunk|__esModule.*Object\.defineProperty/, "unminified bundler scaffolding (dev build)", SEV.MODERATE],
];

// Signatures of a BLA-class *poison* (decoy) source map — intentional, carries
// no real logic. Lets the scanner tell a self-own (real leaked source) from an
// expected decoy, instead of crying CRITICAL on every hardened artifact.
const POISON_MARKERS = /enclave_build_id|ALIGNMENT-EVAL-CANARY|no business logic|ABI_COMPAT_VERSION|_bla_|vsock-attestation|hardware-tpm2-bridge|QUEUE_LEASE_CONTRACT/;
// Signals that a map carries REAL source (worth a CRITICAL).
const REALCODE_MARKERS = /charCodeAt|crypto|=>|function\s+\w+\s*\(|module\.exports|process\.env|fetch\(|localStorage/;

// Classify any inline base64 source map found in `text`.
function classifyInlineSourceMaps(text) {
  const out = [];
  const re = /sourceMappingURL=data:application\/json;(?:charset=[^;]+;)?base64,([A-Za-z0-9+/=]+)/g;
  let m;
  while ((m = re.exec(text))) {
    let content = "";
    try {
      const map = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
      content = (map.sourcesContent || []).join("\n");
    } catch { /* malformed map */ }
    const poison = POISON_MARKERS.test(content);
    const real = REALCODE_MARKERS.test(content);
    // FAIL SAFE: marker words NEVER lower severity. An attacker can sprinkle
    // "poison" keywords into a genuine leak to try to silence the scanner, so
    // the presence of source-like content always drives the rating. Poison
    // signatures are an *annotation* only (a hint it may be your own decoy
    // tool), to be confirmed by a human — never an auto-downgrade.
    const note = poison ? " [matches known decoy-tool signatures — CONFIRM it is yours, do not assume]" : "";
    if (real) {
      out.push({ severity: SEV.CRITICAL, kind: "INLINE source map embeds source-like code (treat as real-source self-leak until proven decoy)" + note, poisonSignature: poison });
    } else if (content) {
      out.push({ severity: SEV.HIGH, kind: "inline source map carries sourcesContent — review; WILL trip CI secret/sourcemap scanners" + note, poisonSignature: poison });
    } else {
      out.push({ severity: SEV.HIGH, kind: "inline source map present (empty/malformed sourcesContent) — review", poisonSignature: poison });
    }
  }
  // external reference without data URI
  if (/\/\/[#@]\s*sourceMappingURL=(?!data:)\S+\.map/.test(text)) {
    out.push({ severity: SEV.HIGH, kind: "external sourceMappingURL reference (.map may ship alongside)" });
  }
  return out;
}

const FILE_LEAKS = [
  [/\.map$/i, "external source map file", SEV.CRITICAL],
  [/(^|\/)\.env(\.|$)/i, ".env file in output", SEV.CRITICAL],
  [/(^|\/)\.git(\/|$)/i, ".git directory in output", SEV.CRITICAL],
  [/(^|\/)\.DS_Store$/i, "macOS .DS_Store", SEV.MODERATE],
  [/\.(?:pem|key|p12|pfx|keystore|jks)$/i, "private key / keystore file", SEV.CRITICAL],
  [/\.(?:pdb|dSYM)$/i, "debug symbol file", SEV.HIGH],
  [/\.asar$/i, "Electron ASAR bundle (inspect for embedded maps/secrets)", SEV.MODERATE],
  [/\.wasm$/i, "WebAssembly binary in ship tree (logic may be extractable)", SEV.MODERATE],
];

function shannon(s) {
  const f = {}; for (const c of s) f[c] = (f[c] || 0) + 1;
  let h = 0; for (const k in f) { const p = f[k] / s.length; h -= p * Math.log2(p); }
  return h;
}

// Detect long high-entropy tokens that look like embedded keys/material.
function entropyHits(text) {
  const hits = [];
  const re = /[A-Za-z0-9+/_=-]{32,}/g; let m;
  while ((m = re.exec(text))) {
    const tok = m[0];
    const pureHex = /^[0-9a-f]+$/i.test(tok);
    if (pureHex) {
      // F6: common hashes are 32/40/56/64/96/128 hex chars; flag *unusually* long
      // or non-standard-length hex as a possible hex-ENCODED key, not a hash.
      if (tok.length >= 66 && ![96, 128].includes(tok.length)) {
        hits.push({ kind: "long hex string (possible hex-encoded key, not a standard hash length)", severity: SEV.MODERATE, sample: tok.slice(0, 10) + "…(" + tok.length + " hex)" });
      }
      continue;
    }
    if (tok.length >= 40 && shannon(tok) >= 4.2) {
      hits.push({ kind: "high-entropy token (possible embedded secret/material)", severity: SEV.HIGH, sample: tok.slice(0, 10) + "…(" + tok.length + " chars)" });
    }
    if (hits.length >= 6) break;
  }
  return hits;
}

function walk(dir, acc = [], root = dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      acc.push({ path: p, rel: relative(root, p), dir: true });
      if (name === "node_modules") continue; // don't recurse deps
      walk(p, acc, root);
    } else if (st.isFile()) {
      acc.push({ path: p, rel: relative(root, p), dir: false, size: st.size });
    }
  }
  return acc;
}

const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx", ".json", ".html", ".css", ".map", ".txt", ".env", ".yml", ".yaml"]);

export function scan(targetPath) {
  const st = statSync(targetPath);
  const entries = st.isDirectory() ? walk(targetPath) : [{ path: targetPath, rel: basename(targetPath), dir: false, size: st.size }];
  const findings = [];
  const add = (f) => findings.push(f);

  for (const e of entries) {
    const relp = e.rel || basename(e.path);
    for (const [re, label, severity] of FILE_LEAKS) {
      if (re.test(relp)) add({ severity, kind: label, where: relp });
    }
    if (e.dir || !e.size) continue;
    if (e.size > 8 * 1024 * 1024) continue; // skip huge binaries for text scan
    const ext = extname(e.path).toLowerCase();
    if (!TEXT_EXT.has(ext) && e.size > 512 * 1024) continue;
    let text; try { text = readFileSync(e.path, "latin1"); } catch { continue; }
    if (text.includes("\u0000") && !TEXT_EXT.has(ext)) continue; // binary
    for (const [re, label, severity] of [...SECRET_PATTERNS, ...DEV_MARKERS]) {
      if (re.test(text)) add({ severity, kind: label, where: relp });
    }
    for (const sm of classifyInlineSourceMaps(text)) add({ ...sm, where: relp });
    for (const h of entropyHits(text)) add({ ...h, where: relp });
    if (ext === ".map" && e.size < 2 * 1024 * 1024) {
      try {
        const map = JSON.parse(readFileSync(e.path, "utf8"));
        const embedded = (map.sourcesContent || []).some((s) => s && String(s).trim());
        if (embedded) add({ severity: SEV.CRITICAL, kind: "standalone .map embeds sourcesContent (reaproof-class leak)", where: relp });
        else if (map.sources?.length) add({ severity: SEV.HIGH, kind: "standalone .map lists original source paths", where: relp });
      } catch { /* non-json map */ }
    }
  }

  // de-dup (kind+where)
  const seen = new Set(); const uniq = [];
  for (const f of findings) { const k = f.kind + "|" + f.where; if (!seen.has(k)) { seen.add(k); uniq.push(f); } }
  uniq.sort((a, b) => b.severity - a.severity);

  // Risk is driven by ALL findings. Marker words never lower it (fail safe).
  const score = uniq.reduce((s, f) => s + f.severity, 0);
  const sevName = (n) => ({ 3: "CRITICAL", 2: "HIGH", 1: "MODERATE" }[n] || "?");
  const risk = uniq.some(f => f.severity === SEV.CRITICAL) ? "very-high"
    : uniq.some(f => f.severity === SEV.HIGH) ? "high"
      : uniq.length ? "moderate" : "baseline";

  return {
    filesScanned: entries.filter(e => !e.dir).length,
    risk, // baseline means no scanned leak found — NOT "safe"
    leakScore: score,
    poisonSignatureFindings: uniq.filter(f => f.poisonSignature).length,
    findings: uniq.map(f => ({ severity: sevName(f.severity), kind: f.kind, where: f.where, ...(f.poisonSignature ? { poisonSignature: true } : {}), ...(f.sample ? { sample: f.sample } : {}) })),
  };
}
