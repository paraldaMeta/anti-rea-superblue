// Attribution / traceback proof. Legal active-defense only: detect, attribute,
// revoke, and build an evidence trail. No hack-back.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.mjs";
import { makeClient } from "./client.mjs";
import { makeWatermark, watermarkClient, buildFingerprint } from "./watermark.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const line = (s) => console.log(s);
const post = (base, path, obj) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) }).then(r => r.json());
const get = (base, path, headers = {}) => fetch(`${base}${path}`, { headers });

const server = createServer();
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
mkdirSync(join(root, "builds"), { recursive: true });

// ---- vendor ships a UNIQUE watermarked build to each customer ----
line("\n=== VENDOR: per-recipient watermarked builds ===");
const builds = {};
for (const user of ["alice", "bob"]) {
  const wm = makeWatermark(user);
  const src = watermarkClient(join(root, "src", "client.mjs"), base, wm);
  const path = join(root, "builds", `client.${user}.mjs`);
  writeFileSync(path, src);
  await post(base, "/register-build", { user, canaryId: wm.canaryId, honeytoken: wm.honeytoken });
  builds[user] = { wm, path, fp: buildFingerprint(src) };
  line(`  ${user}: canaryId=${wm.canaryId}  honeytoken=${wm.honeytoken}  fp=${builds[user].fp}`);
}

// ---- legit usage by alice ----
line("\n=== LEGIT: alice ===");
const aliceKey = (await (await get(base, "/issue?user=alice")).json()).licenseKey;
const alice = makeClient(base, { deviceId: "alice-laptop" });
await alice.activate(aliceKey);
line(`  premium -> ${(await alice.premium("hello")).result}`);

// ---- LEAK SCENARIO 1: attacker scrapes BOB's build and trips the honeytoken ----
line("\n=== TRACEBACK 1: honeytoken (attacker scraped a binary) ===");
line(`  attacker greps bob's build, finds __FALLBACK_LICENSE = ${builds.bob.wm.honeytoken}`);
await fetch(`${base}/activate`, { method: "POST", headers: { "content-type": "application/json", "x-device": "attacker-vm", "user-agent": "curl/8" }, body: JSON.stringify({ licenseKey: builds.bob.wm.honeytoken, deviceId: "attacker-vm" }) });
line(`  -> server returns a generic failure (attacker learns nothing), but internally ATTRIBUTES the leak to BOB.`);

// ---- LEAK SCENARIO 2: bob's watermarked build runs in an un-isolated analysis env ----
line("\n=== TRACEBACK 2: canary beacon (build executed with network) ===");
await get(base, `/canary?id=${builds.bob.wm.canaryId}&ev=load`, { "user-agent": "node-analysis-sandbox", "x-device": "sandbox-7" });
line(`  -> bob's build phoned home from an analysis environment; flagged.`);

// ---- ANOMALY: alice's token used from a second device (sharing / cloned client) ----
line("\n=== ANOMALY: token sharing / cloned client ===");
const sharedToken = alice._token();
await fetch(`${base}/premium`, { method: "POST", headers: { "content-type": "application/json", "x-device": "alice-laptop" }, body: JSON.stringify({ token: sharedToken, input: "a" }) });
await fetch(`${base}/premium`, { method: "POST", headers: { "content-type": "application/json", "x-device": "unknown-box-42" }, body: JSON.stringify({ token: sharedToken, input: "b" }) });
line(`  -> same token seen on 2 device fingerprints; flagged as sharing.`);

// ---- RESPONSE: revoke (kill switch) ----
line("\n=== RESPONSE: revoke ===");
await post(base, "/revoke", { user: "bob" });
const afterRevoke = await post(base, "/premium", { token: sharedToken, input: "c" }); // alice still works
await post(base, "/revoke", { jti: JSON.parse(Buffer.from(sharedToken.split(".")[0], "base64url")).jti });
const aliceAfter = await post(base, "/premium", { token: sharedToken, input: "d" });
line(`  bob revoked (kill switch). alice token revoked -> /premium: ${aliceAfter.error ? "❌ " + aliceAfter.error : "✅"}`);

// ---- EVIDENCE: forensic attribution report ----
line("\n=== FORENSIC REPORT: bob ===");
const report = await (await get(base, "/forensics?user=bob")).json();
line(`  burned=${report.burned}  revoked=${report.revoked}  events=${report.eventCount}`);
for (const f of report.flags) line(`   • ${f}`);
line("\n=== FORENSIC REPORT: alice ===");
const ra = await (await get(base, "/forensics?user=alice")).json();
line(`  burned=${ra.burned}  revoked=${ra.revoked}  events=${ra.eventCount}`);
for (const f of ra.flags) line(`   • ${f}`);

line("\n=== WHAT THIS IS (and isn't) ===");
line("  ✅ detection + attribution + revocation + an evidence trail you can take to");
line("     a lawyer or platform abuse team. Each leaked build traces to ONE buyer.");
line("  ❌ NOT hack-back: nothing runs on the attacker's machine; the canary is a");
line("     plain HTTP ping and a network-isolated analyst defeats it. The durable");
line("     signal is server-side telemetry, which the L1 lock already routes to you.");

server.close();
