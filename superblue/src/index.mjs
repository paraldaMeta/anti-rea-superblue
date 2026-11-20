#!/usr/bin/env node
// SuperBlue — layered blue-team pipeline vs REA-class AI reverse engineering.
// Contain (L0) -> Architect (L1, advice) -> Harden+Verify (L2) -> Tarpit (L3) -> Re-scan.
// Philosophy: evidence over promises. Every layer reports what it measurably did;
// nothing here claims a target becomes "unbreakable".
import { mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "./scan.mjs";
import { harden, esbuildAvailable } from "./harden.mjs";
import { tarpit, tarpitAvailable } from "./tarpit.mjs";
import { verifyEquivalence } from "./verify.mjs";
import { applyChaff, estimateReaFriction } from "./chaff.mjs";
import { policyEnvelope, POLICY_VERSION } from "./policy.mjs";

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--oracle") a.oracle = argv[++i];
    else if (t === "--out") a.out = argv[++i];
    else if (t === "--no-tarpit") a.noTarpit = true;
    else if (t === "--json") a.json = true;
    else if (t === "--block-level") a.blockLevel = argv[++i];
    else if (t === "--timeout-ms") a.timeoutMs = parseInt(argv[++i], 10);
    else if (t === "--intensity") a.intensity = argv[++i];
    else if (t === "--chaff-level") a.chaffLevel = argv[++i];
    else if (t === "--no-chaff") a.noChaff = true;
    else if (t === "--max-friction") { a.maxFriction = true; a.chaffLevel = "extreme"; a.intensity = "bankrupt"; }
    else a._.push(t);
  }
  return a;
}

const here = join(dirname(fileURLToPath(import.meta.url)), "..");
function readClientConstitution() {
  const p = join(here, "templates", "CLIENT-CONSTITUTION.md");
  return existsSync(p) ? readFileSync(p, "utf8") : "# CLIENT-CONSTITUTION missing\n";
}

const L1_ADVICE = [
  "Move the secret/licensing/authorization decision to a server you control; ship only a request.",
  "Client-side logic is observable — a behavioural rebuilder (e.g. Craft Anything, clean-room) reconstructs it WITHOUT reading your code, so no client obfuscation/tarpit stops it.",
  "Prefer server-issued, short-lived, attested tokens over any in-binary key or constant.",
  "Treat L0–L3 as cost-raising for REA-class *static/agent decompilation*, not as protection against behavioural cloning.",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (cmd !== "run" || !args._[1]) {
    console.log(`SuperBlue — layered anti-REA blue-team pipeline (defensive use only)

Usage:
  superblue run <target.js> --oracle <oracle.mjs> [--out <dir>] [--no-tarpit] [--json]
                            [--block-level critical|high|moderate] [--timeout-ms <n>]
                            [--intensity stealth|balanced|maximum|bankrupt]
                            [--chaff-level light|heavy|extreme] [--no-chaff]
                            [--max-friction]

Gate (F5): --block-level sets the leak severity that FAILS the build (default: critical).
Friction: L2.5 chaff (default heavy when L3 on) + L3 tarpit burn REA DEFAULT semantic budgets.
          --max-friction = chaff extreme + BLA bankrupt (still beaten by raised budgets — honest).
Verify (F4): equivalence runs in an isolated child process with a wall-clock timeout.
Policy: report includes policy v${POLICY_VERSION} envelope (AIHOT-style versioned rules).

Layers:
  L0 Contain    leak/secret/source-map scan (gate)         [always]
  L1 Architect  server-side advice (printed; not applied)  [always]
  L2 Harden     esbuild minify+mangle, verify equivalence  ${esbuildAvailable() ? "[ready]" : "[fallback: strip-only]"}
  L2.5 Chaff    inert semantic budget expander (pre-L3)    [on when L3 on, unless --no-chaff]
  L3 Tarpit     BLA-fork, verify equivalence               ${tarpitAvailable() ? "[ready]" : "[unavailable]"}
  re-scan       Contain scan on final artifact

The oracle module exports { entry, samples(), equals? } for behavioural checks.`);
    process.exit(args._[0] ? 2 : 0);
  }

  const target = resolve(args._[1]);
  const outDir = resolve(args.out || join(process.cwd(), "superblue-out"));
  mkdirSync(outDir, { recursive: true });
  const BLOCK = { critical: 3, high: 2, moderate: 1 };
  const blockLevelName = (args.blockLevel || "critical").toLowerCase();
  const blockThreshold = BLOCK[blockLevelName] ?? 3; // F5: configurable gate
  const SEVRANK = { CRITICAL: 3, HIGH: 2, MODERATE: 1 };
  const atOrAbove = (findings) => findings.filter(f => (SEVRANK[f.severity] || 0) >= blockThreshold);
  const name = basename(target).replace(/\.(mjs|cjs|js)$/, "");
  const report = { target, generatedAt: new Date().toISOString(), layers: {} };

  // L0 — Contain (on the ORIGINAL)
  const l0 = scan(target);
  report.layers.L0_contain = l0;
  const blockingLeaks = atOrAbove(l0.findings); // F5: at or above configured block level

  // L1 — Architect (advice only)
  report.layers.L1_architect = { advice: L1_ADVICE };

  // L2 — Harden + verify
  const hardenedPath = join(outDir, `${name}.L2.mjs`);
  const l2 = { ...harden(target, hardenedPath) };
  l2.containment = scan(hardenedPath); // the real shipped logic must be leak-clean
  if (args.oracle) {
    try { l2.equivalence = await verifyEquivalence(target, hardenedPath, resolve(args.oracle), { timeoutMs: args.timeoutMs }); }
    catch (e) { l2.equivalence = { pass: false, error: String(e) }; }
  } else l2.equivalence = { skipped: "no --oracle; cannot verify behaviour" };
  report.layers.L2_harden = l2;

  const tarpitOn = !args.noTarpit && tarpitAvailable();
  const chaffLevel = args.chaffLevel || (args.maxFriction ? "extreme" : "heavy");
  const tarpitIntensity = args.intensity || "bankrupt";
  let tarpitInput = hardenedPath;

  // L2.5 — Semantic chaff (before L3; inert dead code)
  if (tarpitOn && !args.noChaff) {
    const chaffPath = join(outDir, `${name}.L2.5.mjs`);
    const l25 = applyChaff(hardenedPath, chaffPath, chaffLevel);
    report.layers.L2_5_chaff = l25;
    tarpitInput = chaffPath;
  } else {
    report.layers.L2_5_chaff = { applied: false, note: args.noChaff ? "disabled via --no-chaff" : "skipped (no L3)" };
  }

  // L3 — Tarpit + verify
  let finalArtifact = hardenedPath;
  if (tarpitOn) {
    const tarpitPath = join(outDir, `${name}.L3.js`);
    const l3 = { ...tarpit(tarpitInput, tarpitPath, { intensity: tarpitIntensity }) };
    if (l3.applied && args.oracle) {
      try { l3.equivalence = await verifyEquivalence(target, tarpitPath, resolve(args.oracle), { timeoutMs: args.timeoutMs }); }
      catch (e) { l3.equivalence = { pass: false, error: String(e) }; }
      if (l3.equivalence.pass) finalArtifact = tarpitPath;
    }
    report.layers.L3_tarpit = l3;
  } else {
    report.layers.L3_tarpit = { applied: false, note: args.noTarpit ? "disabled via --no-tarpit" : "unavailable" };
  }

  // Re-scan the final shipped artifact
  copyFileSync(finalArtifact, join(outDir, `${name}.SHIPPED${finalArtifact.endsWith(".js") ? ".js" : ".mjs"}`));
  report.finalArtifact = finalArtifact;
  report.layers.reScan = scan(finalArtifact);

  // Verdict. Containment is gated on the ORIGINAL and the clean L2 output — NOT
  // on the L3 artifact (which intentionally carries decoys). The L3 artifact is
  // reported but flagged as scanner-tripping.
  const l3applied = report.layers.L3_tarpit.applied;
  const l2Blocking = atOrAbove(l2.containment.findings);
  report.verdict = {
    blockLevel: blockLevelName,
    containmentPassed: blockingLeaks.length === 0 && l2Blocking.length === 0,
    blockingFindings: { original: blockingLeaks.length, shippedLogic: l2Blocking.length },
    shippedLogicClean: l2.containment.risk === "baseline",
    behaviourPreserved: (report.layers.L3_tarpit.equivalence?.pass ?? report.layers.L2_harden.equivalence?.pass) === true,
    finalArtifactFindings: report.layers.reScan.findings.length,
    scannerWarning: (l3applied && report.layers.reScan.risk !== "baseline")
      ? `Final (L3) artifact scans as risk=${report.layers.reScan.risk}: BLA's tarpit injects a content-laden poison source map + decoy tokens. They carry no real logic, but any generic CI secret/sourcemap scanner (and this one) cannot tell them from a real leak and WILL fail the build. Ship the --no-tarpit (L0+L2) output for a scanner-clean release.`
      : undefined,
    honestNote: "SuperBlue raises REA-class decompilation cost and removes leaks; it does NOT make the target unbreakable, and does NOT stop behavioural cloning (that needs L1 server-side).",
    reaFrictionEstimate: estimateReaFriction(report.layers.L2_5_chaff, report.layers.L3_tarpit),
  };
  report.policy = policyEnvelope(report);

  // CI exit code: fail when containment gate fails, or when an oracle WAS given
  // and behaviour was not preserved. (No oracle → behaviour is simply unchecked.)
  const behaviourFailed = !!args.oracle && report.verdict.behaviourPreserved !== true;
  const exitCode = (!report.verdict.containmentPassed || behaviourFailed) ? 2 : 0;
  report.verdict.exitCode = exitCode;
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, "POLICY.json"), JSON.stringify(report.policy, null, 2));
  writeFileSync(join(outDir, "CLIENT-CONSTITUTION.md"), readClientConstitution());

  if (args.json) { console.log(JSON.stringify(report, null, 2)); process.exit(exitCode); }

  // Human summary
  const S = (b) => (b ? "✅" : "❌");
  console.log(`\n🛡️  SuperBlue — ${basename(target)}   (block-level: ${blockLevelName})\n`);
  console.log(`L0 Contain : risk=${l0.risk}  files=${l0.filesScanned}  findings=${l0.findings.length}  (blocking=${blockingLeaks.length})`);
  for (const f of l0.findings.slice(0, 8)) console.log(`             - [${f.severity}] ${f.kind} @ ${f.where}`);
  if (blockingLeaks.length) console.log(`             ⚠️  FIX BLOCKING LEAKS FIRST (≥${blockLevelName}) — a tarpit on a leaked source map is pointless.`);
  console.log(`L1 Architect: ${L1_ADVICE[0]}`);
  const l25 = report.layers.L2_5_chaff;
  console.log(`L2 Harden  : ${l2.tool}  ${l2.beforeBytes}B→${l2.afterBytes}B  idReduction=${l2.identifierReductionPct ?? "n/a"}%  equiv=${S(l2.equivalence?.pass)}  shipped-logic-clean=${S(l2.containment.risk === "baseline")}`);
  console.log(`L2.5 Chaff : ${l25.applied ? `${l25.level} ×${l25.sizeMultiplier}  decoys=${l25.decoys} alias=${l25.aliasDepth}` : l25.note}`);
  const l3 = report.layers.L3_tarpit;
  const fr = report.verdict.reaFrictionEstimate;
  console.log(`L3 Tarpit  : ${l3.applied ? `${l3.tool}  ×${l3.sizeMultiplier} size  equiv=${S(l3.equivalence?.pass)}` : l3.note}`);
  if (fr) console.log(`REA est.   : illustrative semantic pressure ~${fr.illustrativeSemanticUnits} (${fr.note.split(".")[0]})`);
  console.log(`Re-scan    : risk=${report.layers.reScan.risk}  findings=${report.layers.reScan.findings.length}  (poison-signature=${report.layers.reScan.poisonSignatureFindings})`);
  console.log(`\nVerdict    : containment ${S(report.verdict.containmentPassed)}  shipped-logic-clean ${S(report.verdict.shippedLogicClean)}  behaviour ${S(report.verdict.behaviourPreserved)}`);
  if (report.verdict.scannerWarning) console.log(`             ⚠️  ${report.verdict.scannerWarning}`);
  console.log(`             ${report.verdict.honestNote}`);
  console.log(`\nArtifacts  : ${outDir}`);
  console.log(`Exit       : ${exitCode}${exitCode ? "  (CI gate FAILED)" : ""}\n`);
  process.exit(exitCode);
}

main().catch((e) => { console.error(e); process.exit(1); });
