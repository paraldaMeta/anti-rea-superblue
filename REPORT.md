# BLA red/blue team + hardened fork — results

**Date:** 2026-11-20 · **Machine:** local (macOS arm64) · **All numbers below are measured on this machine unless labeled "modeled".**

## TL;DR

- All three tools are real: `bla-agents` (now npm 3.5.1), REA = `morluto/rea` (`rea-agents` 6.9.0), Craft Anything = `storytold/craft-anything`.
- I reproduced BLA's benchmark (**1070.7× aggregate**) and confirmed from source that every token/cost multiplier is **computed by `token-estimator.ts`, not measured** from a real REA run. The only independently-verifiable BLA claim is runtime-equivalence of the hardened file — which I verified myself (5,011 inputs, 0 mismatches; 283 B → 154 KB, ~545× size tax).
- **Red team (free, no LLM spend):** I ran REA's own static analyzer against a `bankrupt`-hardened file. REA did **not** go bankrupt — it bounded the traps, recovered a mostly-complete graph (`complete:297, partial:70`), and its own error text told the attacker how to defeat it: *"Increase `semantic_precision.alias_selections` … no REA restart is required."* Passing `--semantic-precision '{"alias_selections":65536,...}'` dropped REA's output from **29 MB to ~0.3 MB with zero trap hits**. The bankrupt tarpit is defeated by **one CLI flag**.
- **Blue team (the fork):** I forked the source, wired the (previously dead) intensity profile into the real traps, and made the alias/getter/primitive chains **deeper and seed-jittered per build**. Result against a **default-budget** REA: the run went from **9 s / success** (upstream) to **302 s then hard failure** (`exit 1`, REA's 300 s wall-clock timeout) — a real, measured DoS of the default-budget analyzer, for only +19 % file size, with runtime-equivalence preserved.
- **Honest limit (measured, not hand-waved):** the same `--semantic-precision 65536` raise that beat upstream **also beats the fork** in ~15 s — raising the budget both skips the traps and avoids the timeout. Per-build jitter stops a *canned* bypass script, but a determined attacker who raises budgets still wins. **"Unbreakable against REA + Craft" is not achievable** and I did not claim it.

## What I could not do (and why)

- **Craft Anything attack:** not installed here (no app, no `claude` builder). Running it needs a desktop-app install + your Claude Code sign-in + your spend. Not something I can do autonomously.
- **Live "Bankrupt-level" REA *agent* loop:** a real agent attack drives an LLM that is designed to burn up to millions of tokens — unbounded spend on your account. I ran REA's **free static analyzer** (the part that actually trips BLA's budgets) instead, which is where the defense lives anyway. If you want the paid live-agent run, approve a budget and I'll do it.

## What the fork changes

1. `src/shields/tarpit/tarpit-generator.ts` — alias-chain depth, primitive-term count, and getter count are now intensity-scaled **and** seed-jittered (upstream hardcoded 28 / 16 / 16 regardless of intensity). Deepening is near-free in bytes but drives REA's semantic state counts; jitter means no single budget value bypasses every build.
2. `src/core/token-estimator.ts` — removed the generation-behind Opus 4 / Sonnet 4 / o3 price table's misleading framing: added a prominent note that the multipliers are **modeled, share their assumptions, and are not a real bill**, and relabeled the models as illustrative/overridable.
3. Package renamed to `bla-agents-hardened` + version `3.5.1-hardened.1` so it cannot be mistaken for the official package. Defensive-use-only disclaimer retained.

## Also found

- The profile fields BLA advertises in `counter-rea-matrix.md` (`aliasSelectorCount`, `ternaryChunkCount`, `cartesianBranchCount`, `cartesianStringLength`) are **dead code** upstream — no emitter reads them. Only `obligationDecoyFamilies` and `sccClusterCount` were wired. The fork wires the semantic ones in for real.

## Deliverable

- Installable tarball: `bla-agents-hardened-3.5.1-hardened.1.tgz` (project root). Install with `npm i -g ./bla-agents-hardened-3.5.1-hardened.1.tgz` (needs Node ≥22.23.4/24/26), then `bla harden .`.
- Patched source: `upstream-src/` (git clone of `qybaihe/bla` with the diffs above).
- Evidence files: `attack/rea-*.out` (REA runs), `sample/` (hardened samples + equivalence harness).

## Honest bottom line

BLA is a tollbooth, not a lock, and the fork is a **taller tollbooth, not a lock**. It raises the cost of a casual, default-configured REA pass from seconds to a hard timeout, which is genuinely useful against "ran the tool once" attackers. It does not and cannot stop an analyst who raises REA's budgets or reaches for Ghidra/Frida by hand. Treat the dollar multipliers as marketing; treat runtime-equivalence and the measured default-budget timeout as the real, load-bearing results.
