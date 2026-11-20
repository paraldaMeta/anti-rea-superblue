// Tamper-evident forensic reports. The server signs a canonical serialization of
// the report with its Ed25519 signing key; anyone can verify with the public key.
// A single changed byte breaks the signature — usable as evidence.
import { sign, verify, createPrivateKey, createPublicKey } from "node:crypto";

// Deterministic JSON (sorted keys) so the signed bytes are reproducible.
function stable(x) {
  if (Array.isArray(x)) return "[" + x.map(stable).join(",") + "]";
  if (x && typeof x === "object") {
    return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + stable(x[k])).join(",") + "}";
  }
  return JSON.stringify(x);
}

export function signReport(report, privatePem) {
  const envelope = { report, alg: "ed25519", signedAt: new Date().toISOString() };
  const sig = sign(null, Buffer.from(stable(envelope)), createPrivateKey(privatePem)).toString("base64");
  return { ...envelope, signature: sig };
}

export function verifyReport(signed, publicPem) {
  try {
    const { signature, ...envelope } = signed;
    if (!signature) return { ok: false, reason: "no-signature" };
    const ok = verify(null, Buffer.from(stable(envelope)), createPublicKey(publicPem), Buffer.from(signature, "base64"));
    return { ok, reason: ok ? "valid" : "signature-mismatch (tampered or wrong key)" };
  } catch (e) {
    return { ok: false, reason: "error:" + (e && e.message) };
  }
}
