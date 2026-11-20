// Hardware-backed device attestation (proof-of-possession).
// Replaces the soft `sha256(deviceId)` fingerprint — which a copied token could
// spoof by resending a header — with a key SEALED in the device's secure element.
//
// Here the key is an in-process Ed25519 keypair for the demo. In PRODUCTION the
// private key is non-exportable and lives in:
//   - TPM 2.0 (Windows/Linux)            — Attestation Identity Key
//   - Apple Secure Enclave               — SecKey + DeviceCheck/App Attest
//   - Android StrongBox / Key Attestation
//   - WebAuthn / FIDO2 authenticators    — platform passkey
// You only ever get SIGNATURES out; the token is bound to that key, so a stolen
// token is useless without the physical secure element.
import { generateKeyPairSync, sign, verify, createHash, createPublicKey } from "node:crypto";

export function createHardwareKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  return { privateKey, publicKeyB64 }; // privateKey stands in for a non-exportable enclave key
}

export function hwFingerprint(publicKeyB64) {
  return createHash("sha256").update("hwfp:" + publicKeyB64).digest("hex").slice(0, 16);
}

// Device proves possession by signing a server-issued, one-time challenge.
export function attest(challenge, privateKey) {
  return sign(null, Buffer.from(challenge), privateKey).toString("base64");
}

export function verifyAttestation(challenge, publicKeyB64, sigB64) {
  try {
    const pub = createPublicKey({ key: Buffer.from(publicKeyB64, "base64"), format: "der", type: "spki" });
    return verify(null, Buffer.from(challenge), pub, Buffer.from(sigB64, "base64"));
  } catch { return false; }
}
