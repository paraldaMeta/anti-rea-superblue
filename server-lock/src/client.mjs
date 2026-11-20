// The CLIENT bundle. This is what an attacker gets to read in full (REA) or
// behaviourally rebuild (Craft). Note what is NOT here:
//   - no license-validation secret   (can't forge keys)
//   - no token-signing private key    (can't forge tokens)
//   - no premiumTransform logic        (nothing to clone — it runs on the server)
// It ships ONLY the PUBLIC key, which is useless for forging anything.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyToken } from "./token.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PEM = readFileSync(join(root, "client-dist", "public-key.pem"), "utf8");

export function makeClient(baseUrl, { deviceId = "device-1" } = {}) {
  let token = null;
  const post = async (path, obj) => {
    const r = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
    return { status: r.status, body: await r.json() };
  };
  return {
    async activate(licenseKey) {
      const { status, body } = await post("/activate", { licenseKey, deviceId });
      if (status !== 200) return { ok: false, reason: body.error };
      token = body.token;
      return { ok: true };
    },
    // Offline gate for UX only. Verifiable with the public key; cannot be forged.
    isLicensed() { return token ? verifyToken(token, PUBLIC_PEM).ok : false; },
    // The actual value comes from the server; a patched/cloned client still needs a valid token.
    async premium(input) {
      const { status, body } = await post("/premium", { token, input });
      if (status !== 200) return { ok: false, reason: body.reason || body.error };
      return { ok: true, result: body.result };
    },
    _token: () => token,
  };
}
