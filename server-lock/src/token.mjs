// Minimal signed-token format (Ed25519). payload.sig where sig signs payload.
// Verification needs ONLY the public key; minting needs the private key.
import { sign, verify, createPublicKey, createPrivateKey } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const unb64url = (s) => Buffer.from(s, "base64url");

export function mint(payloadObj, privatePem) {
  const key = createPrivateKey(privatePem);
  const payload = b64url(JSON.stringify(payloadObj));
  const sig = b64url(sign(null, Buffer.from(payload), key)); // ed25519: algo=null
  return `${payload}.${sig}`;
}

// Pure-offline verification the client does with the shipped public key.
export function verifyToken(token, publicPem, { now = Date.now() } = {}) {
  try {
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return { ok: false, reason: "malformed" };
    const key = createPublicKey(publicPem);
    const good = verify(null, Buffer.from(payload), key, unb64url(sig));
    if (!good) return { ok: false, reason: "bad-signature" };
    const claims = JSON.parse(unb64url(payload).toString("utf8"));
    if (typeof claims.exp === "number" && now > claims.exp) return { ok: false, reason: "expired" };
    return { ok: true, claims };
  } catch (e) {
    return { ok: false, reason: "error:" + (e && e.message) };
  }
}
