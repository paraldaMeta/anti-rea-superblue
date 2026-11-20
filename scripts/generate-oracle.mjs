#!/usr/bin/env node
// Draft behavioural oracle for superblue run (user confirms before R1 ships).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { parseSimpleExport } from "../superblue/src/relocate.mjs";

const target = resolve(process.argv[2] || "");
const outPath = resolve(process.argv[3] || join(process.cwd(), ".superblue-oracles", "auto.mjs"));

if (!target) {
  console.error("usage: generate-oracle.mjs <target.js> [out/oracle.mjs]");
  process.exit(2);
}

const src = readFileSync(target, "utf8");
const parsed = parseSimpleExport(src);
if (!parsed) {
  console.error("no simple export function found — write oracle manually (see skill recipes.md)");
  process.exit(2);
}

const params = parsed.params.length ? parsed.params : ["input"];
const arity = params.length;
const seeds = ["", "a", "test", "hello", "0", "demo", "x".repeat(40), "🙂"];

const oracle = `// AUTO-GENERATED — review before R1 production-ship. Regenerate: generate-oracle.mjs
// Target: ${basename(target)} · entry: ${parsed.name}
export const entry = ${JSON.stringify(parsed.name)};

export function* samples() {
  const seeds = ${JSON.stringify(seeds)};
  for (const s of seeds) {
    ${arity === 1 ? "yield [s];" : `yield [${params.map((_, i) => i === 0 ? "s" : `"arg${i}"`).join(", ")}];`}
  }
  for (let n = 0; n < 400; n++) {
    const len = n % 12;
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(32 + ((n * 7 + i * 13) % 94));
    ${arity === 1 ? "yield [s];" : `yield [s, ${params.slice(1).map((p, i) => `"n" + ${i}`).join(", ")}];`}
  }
}

export function equals(a, b) {
  if (typeof a === "object" && a && typeof b === "object" && b) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, oracle);
console.log(JSON.stringify({ ok: true, entry: parsed.name, arity, outPath }, null, 2));