#!/usr/bin/env node
// Independently verify a signed forensic report with only the public key.
// Usage: node verify-report.mjs <signed-report.json> [public-key.pem]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReport } from "./report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [, , reportPath, pubPath] = process.argv;
if (!reportPath) { console.error("usage: node verify-report.mjs <signed-report.json> [public-key.pem]"); process.exit(2); }

const signed = JSON.parse(readFileSync(reportPath, "utf8"));
const pub = readFileSync(pubPath || join(root, "client-dist", "public-key.pem"), "utf8");
const r = verifyReport(signed, pub);

console.log(`report      : ${reportPath}`);
console.log(`subject     : ${signed.report?.user}`);
console.log(`signed at   : ${signed.signedAt} (${signed.alg})`);
console.log(`threatScore : ${signed.report?.threatScore}/${signed.report?.threatThreshold}  autoBanned=${signed.report?.autoBanned}`);
console.log(`signature   : ${r.ok ? "✅ VALID — report is authentic and unmodified" : "❌ INVALID — " + r.reason}`);
process.exit(r.ok ? 0 : 1);
