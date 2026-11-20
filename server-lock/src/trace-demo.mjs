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
  await post(base, "/register-build", { user, canaryId: wm.canaryId, honeytokens: wm.honeytokens });
  builds[user] = { wm, path, fp: buildFingerprint(src) };
  line(`  ${user}: canaryId=${wm.canaryId}  honeytokens=T1/T2/T3  fp=${builds[user].fp}`);
}

// ---- legit usage by alice ----
line("\n=== LEGIT: alice ===");
const aliceKey = (await (await get(base, "/issue?user=alice")).json()).licenseKey;
const alice = makeClient(base, { deviceId: "alice-laptop" });
await alice.activate(aliceKey);
line(`  premium -> ${(await alice.premium("hello")).result}`);

// ---- LEAK SCENARIO 1: tiered honeytokens grade the attacker's intent ----
const tripHoney = (dev, ua, value) => fetch(`${base}/activate`, { method: "POST", headers: { "content-type": "application/json", "x-device": dev, "user-agent": ua }, body: JSON.stringify({ licenseKey: value, deviceId: dev }) });
line("\n=== TRACEBACK 1: tiered honeytoken (grades casual vs automated) ===");
line("  (a) casual: someone greps bob's build, tries the obvious plaintext key (T1)");
await tripHoney("curious-1", "Chrome", builds.bob.wm.honeytokens[0].value);
line("  (b) scraper: another attacker base64-decodes the T2 key and tries it");
await tripHoney("scraper-1", "python-requests", builds.bob.wm.honeytokens[1].value);
line("  (c) automation: a harvester hammers many keys fast, then the T3 split key");
for (let i = 0; i < 6; i++) await tripHoney("bot-9", "go-http", "bob.badkey" + i);
await tripHoney("bot-9", "go-http", builds.bob.wm.honeytokens[2].value);
line("  -> all attributed to BOB; each graded low / medium / high by tier + velocity.");

// ---- LEAK SCENARIO 2: bob's watermarked build runs in an un-isolated analysis env ----
line("\n=== TRACEBACK 2: canary beacon (build executed with network) ===");
await get(base, `/canary?id=${builds.bob.wm.canaryId}&ev=load`, { "user-agent": "node-analysis-sandbox", "x-device": "sandbox-7" });
line(`  -> bob's build phoned home from an analysis environment; flagged.`);

const prem = (token, dev, input, geo) => fetch(`${base}/premium`, { method: "POST", headers: { "content-type": "application/json", "x-device": dev, ...(geo ? { "x-geo": geo } : {}) }, body: JSON.stringify({ token, input }) }).then(r => r.json());
const aliceToken = alice._token();

// ---- HARD DEVICE BINDING: a copied token on another machine is DENIED ----
line("\n=== HARD DEVICE BINDING (enforced) ===");
const sameDev = await prem(aliceToken, "alice-laptop", "x");
line(`  alice's own device       : ${sameDev.result ? "✅ " + sameDev.result : "❌ " + sameDev.error}`);
const otherDev = await prem(aliceToken, "stolen-box", "x");
line(`  same token, other machine: ${otherDev.error ? "❌ " + otherDev.error : "✅ " + otherDev.result}  (copied token is useless off the bound device)`);

// ---- IMPOSSIBLE TRAVEL: same device, two far-apart locations in moments ----
line("\n=== IMPOSSIBLE TRAVEL ===");
await prem(aliceToken, "alice-laptop", "x", "1.3521,103.8198");   // Singapore
await prem(aliceToken, "alice-laptop", "x", "40.7128,-74.0060");  // New York, seconds later
line(`  Singapore -> New York in seconds on one account -> flagged (shared/stolen credentials).`);

// ---- RESPONSE: revoke (kill switch) ----
line("\n=== RESPONSE: revoke ===");
await post(base, "/revoke", { user: "bob" });
await post(base, "/revoke", { jti: JSON.parse(Buffer.from(aliceToken.split(".")[0], "base64url")).jti });
const aliceAfter = await prem(aliceToken, "alice-laptop", "d");
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
