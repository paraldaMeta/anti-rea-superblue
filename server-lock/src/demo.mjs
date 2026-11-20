// End-to-end proof. Starts the authority, runs a legit client, then runs four
// attacks that assume the attacker has the ENTIRE client source + public key
// (the REA/Craft threat model). Shows each attack fails.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.mjs";
import { makeClient } from "./client.mjs";
import { mint, verifyToken } from "./token.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PEM = readFileSync(join(root, "client-dist", "public-key.pem"), "utf8");
const line = (s) => console.log(s);
const ok = (b) => (b ? "✅" : "❌");

const server = createServer();
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

// ---------- 1) Legit flow ----------
line("\n=== LEGIT USER ===");
const issued = await (await fetch(`${base}/issue?user=alice`)).json();
line(`vendor issues license : ${issued.licenseKey}`);
const client = makeClient(base, { deviceId: "alice-laptop" });
line(`activate              : ${ok((await client.activate(issued.licenseKey)).ok)}`);
line(`isLicensed() (offline): ${ok(client.isLicensed())}`);
const good = await client.premium("hello");
line(`premium("hello")      : ${ok(good.ok)}  -> ${good.result}`);

// ---------- Attacker fully owns the client ----------
line("\n=== ATTACKER (has full client source + public-key.pem) ===");

// A1: forge a license key without the server secret
line("\n[A1] forge a license key offline");
const forgedClient = makeClient(base, { deviceId: "mallory" });
const a1 = await forgedClient.activate("mallory.deadbeefdeadbeefdeadbeef");
line(`     activate forged key : ${ok(a1.ok)}  (expect ❌ — no SERVER_SECRET to mint keys)`);

// A2: forge a signed token offline (self-sign with a key we generated)
line("\n[A2] forge a premium token offline");
import { generateKeyPairSync } from "node:crypto";
const attackerKeys = generateKeyPairSync("ed25519");
const forgedToken = mint({ sub: "mallory", user: "mallory", scope: "premium", exp: Date.now() + 1e9 },
  attackerKeys.privateKey.export({ type: "pkcs8", format: "pem" }));
const localCheck = verifyToken(forgedToken, PUBLIC_PEM); // client-side verify with SHIPPED public key
line(`     client offline verify: ${ok(localCheck.ok)} (${localCheck.reason})  (expect ❌ bad-signature)`);
const a2 = await (await fetch(`${base}/premium`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: forgedToken, input: "x" }) })).json();
line(`     server /premium      : ${a2.error ? "❌ " + a2.reason : "✅ " + a2.result}  (expect ❌ — server verifies with real public key)`);

// A3: patch the client to skip the gate entirely (isLicensed -> true)
line("\n[A3] patch client gate: isLicensed() always true");
const patched = { ...client, isLicensed: () => true, _token: () => null };
line(`     isLicensed() (patched): ${ok(patched.isLicensed())}  (gate bypassed locally)`);
const a3 = await (await fetch(`${base}/premium`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: null, input: "x" }) })).json();
line(`     but server /premium   : ${a3.error ? "❌ " + a3.reason : "✅ " + a3.result}  (expect ❌ — value is server-side, patch gets nothing)`);

// A4: clone the client (Craft behavioural rebuild) and reproduce premium locally
line("\n[A4] clone client + reproduce premium() locally (Craft threat)");
const clientSrc = readFileSync(join(root, "src", "client.mjs"), "utf8");
line(`     secret FNV constant 0x01000193 in client? ${clientSrc.includes("01000193") ? "yes" : "NO — the valuable logic never shipped"}`);
line(`     a perfect clone still must call the server, which still demands a valid token. Capability was never in the client to copy.`);

line("\n=== RESULT ===");
line("The client can be fully decompiled (REA) or behaviourally cloned (Craft) and the");
line("attacker still cannot: forge a license, forge a token, or reproduce the premium");
line("capability — because the secret, the signing key, and the valuable compute all");
line("live on the server. THIS is a lock. L0–L3 only raise cost; L1 removes the target.");

server.close();
