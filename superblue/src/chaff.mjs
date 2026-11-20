// L2.5 — Semantic chaff (pre-L3). Appends inert, highly-connected dead code that
// never runs at runtime but expands REA-class alias/getter/primitive budgets BEFORE
// the BLA tarpit layer. Behaviour of the real exports is unchanged (append-only).
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const PREFIXES = [
  "reconcileShardCursor", "hydrateTelemetryEnvelope", "negotiatePolicyRevision",
  "materializeAuditBatch", "encodeGatewayFrame", "verifyChannelDigest",
  "compactStateWal", "observeMetricLane", "adaptSessionFacet", "deriveKdfSchedule",
];

/** @param {"light"|"heavy"|"extreme"} level */
export function chaffLevelConfig(level) {
  const L = {
    light: { decoys: 14, alias: 64, getters: 24, double: 14 },
    heavy: { decoys: 28, alias: 128, getters: 56, double: 18 },
    extreme: { decoys: 44, alias: 200, getters: 96, double: 22 },
  };
  return L[level] || L.heavy;
}

function seededId(seed, hint, n) {
  return createHash("sha256").update(`${seed}:${hint}:${n}`).digest("hex").slice(0, 10);
}

/** Generate append-only chaff block. */
export function generateChaff(level = "heavy", seed = randomBytes(8).toString("hex")) {
  const { decoys, alias, getters, double } = chaffLevelConfig(level);
  const lines = [];
  lines.push("/* SuperBlue L2.5 semantic chaff — execution-inert; REA budget friction only */");
  const st = `_sb${seededId(seed, "st", 0)}`;
  lines.push(`const ${st} = 1;`);
  const aliasFn = `_sb${seededId(seed, "alias", 1)}`;
  lines.push(`function ${aliasFn}(_f) { let a0 = {};`);
  for (let i = 1; i <= alias; i++) lines.push(`  const a${i} = _f ? a${i - 1}?.x : a${i - 1}?.y;`);
  lines.push(`  return a${alias} ?? 0; }`);
  const budgetFn = `_sb${seededId(seed, "budget", 2)}`;
  const terms = Array.from({ length: Math.min(getters, 28) }, (_, i) => `(_c?"${i.toString(16)}":"${(i * 3).toString(16)}")`).join("+");
  lines.push(`function ${budgetFn}(_c,_k){ const _x=${terms};`);
  lines.push(`  let s0="frame_";`);
  for (let i = 1; i <= double; i++) lines.push(`  const s${i}=s${i - 1}+s${i - 1};`);
  lines.push(`  class _G{ slot=s${double};`);
  for (let g = 0; g < getters; g++) lines.push(`    get f${g}(){ return this[_k].f${g}; }`);
  lines.push(`  }`);
  lines.push(`  return _x.length ^ ${st}; }`);
  const names = [];
  for (let i = 0; i < decoys; i++) {
    const fn = `_sb${seededId(seed, PREFIXES[i % PREFIXES.length], i)}`;
    names.push(fn);
    const n1 = `_sb${seededId(seed, "n1", i)}`;
    const n2 = `_sb${seededId(seed, "n2", i)}`;
    lines.push(`function ${fn}(v,d){ if(d>0&&(${st}^1)) return ${n1}(v^3,d-1)^${n2}(v,d-1)^${aliasFn}(false)^${budgetFn}(false,"k"); return (v|0)^${st}; }`);
    lines.push(`function ${n1}(v,d){ return d>0?${fn}(v+1,d-1):v; }`);
    lines.push(`function ${n2}(v,d){ return d>0?${fn}(v-1,d-1):v; }`);
  }
  const anchor = `_sb${seededId(seed, "anchor", 99)}`;
  lines.push(`function ${anchor}(){ if((${st}&0)===1) return ${names.slice(0, 6).map((n, i) => `${n}(${i},2)`).join("^")}; return 0; }`);
  lines.push(`void ${anchor};`);
  return { code: lines.join("\n"), level, decoys, aliasDepth: alias, getterCount: getters, seed };
}

/** Illustrative REA semantic-unit estimate (not measured tokens). */
export function estimateReaFriction(chaffMeta, tarpitMeta) {
  const chaffUnits = (chaffMeta?.aliasDepth || 0) * 2 + (chaffMeta?.getterCount || 0) * 3 + (chaffMeta?.decoys || 0) * 12;
  const tarpitMult = tarpitMeta?.sizeMultiplier ? Math.min(500, Math.round(tarpitMeta.sizeMultiplier * 40)) : 0;
  return { illustrativeSemanticUnits: chaffUnits + tarpitMult, note: "Illustrative budget-pressure score, NOT measured LLM tokens. Real cost depends on REA version and raised budgets." };
}

export function applyChaff(inPath, outPath, level = "heavy") {
  const before = readFileSync(inPath, "utf8");
  const meta = generateChaff(level);
  const after = before + "\n" + meta.code + "\n";
  writeFileSync(outPath, after);
  return {
    applied: true,
    level,
    beforeBytes: before.length,
    afterBytes: after.length,
    aliasDepth: meta.aliasDepth,
    getterCount: meta.getterCount,
    decoys: meta.decoys,
    sizeMultiplier: +(after.length / before.length).toFixed(2),
  };
}