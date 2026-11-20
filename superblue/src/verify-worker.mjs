#!/usr/bin/env node
// Isolated equivalence worker. Runs in its own process so a target's import-time
// side effects (and BLA's ~150KB injected code) cannot touch the orchestrator.
// NOTE: a separate OS process is isolation, NOT a security sandbox — run only on
// code you own. argv: <originalPath> <candidatePath> <oraclePath>
import { pathToFileURL } from "node:url";

function defaultEquals(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const [, , originalPath, candidatePath, oraclePath] = process.argv;

try {
  const oracle = await import(pathToFileURL(oraclePath).href);
  const entry = oracle.entry;
  const equals = oracle.equals || defaultEquals;
  if (!entry || typeof oracle.samples !== "function") {
    throw new Error("oracle must export `entry` (string) and `samples()` (generator)");
  }
  const orig = await import(pathToFileURL(originalPath).href);
  const cand = await import(pathToFileURL(candidatePath).href);
  const of = orig[entry] ?? orig.default;
  const cf = cand[entry] ?? cand.default;
  if (typeof of !== "function" || typeof cf !== "function") {
    console.log(JSON.stringify({ pass: false, tested: 0, mismatches: 1, note: `entry '${entry}' not a function on both modules` }));
    process.exit(0);
  }
  let tested = 0, mism = 0; const distinct = new Set();
  for (const args of oracle.samples()) {
    tested++;
    let a, b, ea = null, eb = null;
    try { a = of(...args); } catch (e) { ea = String(e); }
    try { b = cf(...args); } catch (e) { eb = String(e); }
    distinct.add(JSON.stringify(a));
    const same = ea || eb ? ea === eb : equals(a, b);
    if (!same) mism++;
  }
  console.log(JSON.stringify({ pass: mism === 0, tested, mismatches: mism, distinctOracleOutputs: distinct.size }));
} catch (e) {
  console.log(JSON.stringify({ pass: false, error: String(e && e.message || e) }));
}
