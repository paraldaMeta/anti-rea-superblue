// Generate the signing keypair + a server-only license secret.
// The PRIVATE key and SERVER_SECRET stay on the server and NEVER ship.
// Only the PUBLIC key goes into the client bundle (safe to leak).
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "secrets"), { recursive: true });
mkdirSync(join(root, "client-dist"), { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" });
const priv = privateKey.export({ type: "pkcs8", format: "pem" });
const serverSecret = randomBytes(32).toString("hex");

// SERVER-ONLY (chmod 600 in production; here just a separate folder):
writeFileSync(join(root, "secrets", "signing-private.pem"), priv);
writeFileSync(join(root, "secrets", "server-secret.txt"), serverSecret);

// CLIENT-SHIPPABLE (public key only — forging a token requires the private key):
writeFileSync(join(root, "client-dist", "public-key.pem"), pub);

console.log("✅ keygen complete");
console.log("   server-only : secrets/signing-private.pem, secrets/server-secret.txt");
console.log("   client ships : client-dist/public-key.pem  (public — safe to leak)");
