// Attribution / traceback proof. Legal active-defense only: detect, attribute,
// auto-ban, and produce a SIGNED evidence trail. No hack-back.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.mjs";
import { makeClient } from "./client.mjs";
import { makeWatermark, watermarkClient, buildFingerprint } from "./watermark.mjs";
import { attest } from "./attestation.mjs";
import { verifyReport } from "./report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PEM = readFileSync(join(root, "client-dist", "public-key.pem"), "utf8");
const line = (s) => console.log(s);
const post = (base, path, obj, headers = {}) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(obj) }).then(r => r.json());
const get = (base, path, headers = {}) => fetch(`${base}${path}`, { headers });

const server = createServer();
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
mkdirSync(join(root, "builds"), { recursive: true });

// premium call with explicit hardware key (or none, to simulate a thief).
async function prem(token, hw, input, { dev = "d", geo } = {}) {
  const { challenge } = await (await get(base, "/challenge")).json();
  const challengeSig = hw ? attest(challenge, hw.privateKey) : "AA==";
  return post(base, "/premium", { token, input, challenge, challengeSig }, { "x-device": dev, ...(geo ? { "x-geo": geo } : {}) });
}

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

// ---- legit usage by alice (hardware-attested) ----
line("\n=== LEGIT: alice (hardware-attested) ===");
const aliceKey = (await (await get(base, "/issue?user=alice")).json()).licenseKey;
const alice = makeClient(base, { deviceId: "alice-laptop" });
await alice.activate(aliceKey);
line(`  premium -> ${(await alice.premium("hello")).result}`);

// ---- TRACEBACK 1: tiered honeytokens -> grade intent -> AUTO-BAN ----
const tripHoney = (dev, ua, value) => post(base, "/activate", { licenseKey: value, deviceId: dev }, { "x-device": dev, "user-agent": ua });
line("\n=== TRACEBACK 1: tiered honeytokens -> intent grading -> auto-ban ===");
line("  (a) casual   T1 plaintext key"); await tripHoney("curious-1", "Chrome", builds.bob.wm.honeytokens[0].value);
line("  (b) scraper  T2 base64 key");    await tripHoney("scraper-1", "python-requests", builds.bob.wm.honeytokens[1].value);
line("  (c) harvester hammers keys + T3 split key");
for (let i = 0; i < 6; i++) await tripHoney("bot-9", "go-http", "bob.badkey" + i);
await tripHoney("bot-9", "go-http", builds.bob.wm.honeytokens[2].value);
line("  -> all attributed to BOB, graded low/medium/high; cumulative score crosses the line.");

// ---- TRACEBACK 2: canary beacon ----
line("\n=== TRACEBACK 2: canary beacon ===");
await get(base, `/canary?id=${builds.bob.wm.canaryId}&ev=load`, { "user-agent": "node-analysis-sandbox" });
line("  -> bob's build phoned home from an analysis environment.");

// ---- HARDWARE PROOF-OF-POSSESSION: stolen token can't sign ----
line("\n=== HARDWARE BINDING (proof-of-possession) ===");
const aliceToken = alice._token();
const ownDev = await prem(aliceToken, alice._hardware, "x", { dev: "alice-laptop" });
line(`  alice w/ her secure-element : ${ownDev.result ? "✅ " + ownDev.result : "❌ " + ownDev.error}`);
const thief = await prem(aliceToken, null, "x", { dev: "stolen-box" }); // has token, NOT the hardware key
line(`  thief w/ copied token only  : ${thief.error ? "❌ " + thief.error : "✅ " + thief.result}  (can't sign the challenge -> denied)`);

// ---- IMPOSSIBLE TRAVEL ----
line("\n=== IMPOSSIBLE TRAVEL ===");
await prem(aliceToken, alice._hardware, "x", { dev: "alice-laptop", geo: "1.3521,103.8198" });   // Singapore
await prem(aliceToken, alice._hardware, "x", { dev: "alice-laptop", geo: "40.7128,-74.0060" });  // NYC, seconds later
line("  Singapore -> New York in seconds -> flagged (shared/stolen).");

// ---- SIGNED FORENSIC REPORTS ----
line("\n=== SIGNED FORENSIC REPORT: bob ===");
const bobReport = await (await get(base, "/forensics?user=bob")).json();
line(`  threatScore=${bobReport.report.threatScore}/${bobReport.report.threatThreshold}  autoBanned=${bobReport.report.autoBanned}  revoked=${bobReport.report.revoked}`);
for (const f of bobReport.report.flags) line(`   • ${f}`);
const sigCheck = verifyReport(bobReport, PUBLIC_PEM);
line(`  signature: ${sigCheck.ok ? "✅ valid (" + bobReport.alg + ", signed " + bobReport.signedAt + ")" : "❌ " + sigCheck.reason}`);
const reportPath = join(root, "builds", "forensics.bob.signed.json");
writeFileSync(reportPath, JSON.stringify(bobReport, null, 2));
line(`  saved -> ${reportPath}`);

// tamper check
const tampered = JSON.parse(JSON.stringify(bobReport));
tampered.report.threatScore = 0; tampered.report.autoBanned = false;
line(`  tamper (score->0) re-verify: ${verifyReport(tampered, PUBLIC_PEM).ok ? "✅ (BAD)" : "❌ detected — " + verifyReport(tampered, PUBLIC_PEM).reason}`);

line("\n=== SIGNED FORENSIC REPORT: alice ===");
const aliceReport = await (await get(base, "/forensics?user=alice")).json();
line(`  threatScore=${aliceReport.report.threatScore}/${aliceReport.report.threatThreshold}  autoBanned=${aliceReport.report.autoBanned}  revoked=${aliceReport.report.revoked}`);
for (const f of aliceReport.report.flags) line(`   • ${f}`);

line("\n=== WHAT THIS IS (and isn't) ===");
line("  ✅ hardware-bound auth, graded attribution, automatic bans, and a cryptographically");
line("     signed evidence trail you can hand to a lawyer or platform abuse team.");
line("  ❌ NOT hack-back: nothing runs on the attacker's machine. The durable signal is");
line("     server-side; client canaries are a bonus a network-isolated analyst defeats.");

server.close();
