# SuperBlue — reference synthesis (anti-REA survey)

This document maps surveyed GitHub projects to SuperBlue layers. **Honest scope:**
client layers raise cost; only **server-lock (L1)** addresses behavioural cloning.

## Local survey clones (`anti-rea-survey/`)

| Project | What we borrowed into SuperBlue |
|---|---|
| **reaproof** | Expanded L0 secret patterns; standalone `.map` `sourcesContent` check; fail-safe inline map classifier |
| **DeRea** | Optional `--docker-verify` (network=none container); sampled-equivalence honesty |
| **anti-rea-forge (releaseguard)** | Release-gate mindset: private assets outside `dist`; `scan` + exit 2 on blocking leaks |
| **antirea** | `strip-dist` subcommand; pre-ship template |
| **AREA (davepartner)** | `rea-matrix.mjs` REA-surface counter table |
| **ANTI-REA (WEIXUEP)** | Future: native/Python skills are out-of-tree; JS path documented here |
| **MockirDev/antirea** | Hook templates (optional install from survey) |
| **bla-agents fork** | L3 tarpit + intensity; hardened bankrupt depths |
| **server-lock** | L1 lock + attribution (sibling package, not vendored into SuperBlue) |

## External (not cloned; read for integration)

| Project | Worth integrating later |
|---|---|
| **HMAKT99/reashield** | `relocate` server stub generator; WASM numeric offload; dynamic import graph |
| **848gaming/anti-rea** | Platform profiles (Electron fuses, V8 `.jsc`) as `superblue harden --profile electron` |
| **morluto/rea** | Red-team regression: default-budget vs raised-budget analyzer runs |

## What NOT to copy

- Hack-back, anti-Frida destructors in distributed client code
- Claiming obfuscation = unbreakable
- Client-side encryption of secrets the app must decrypt locally

## Suggested CI order (forge-style)

1. `superblue scan dist --block-level high`
2. `superblue strip-dist dist` (or build without maps)
3. `superblue run entry.js --oracle ./oracle.mjs --no-tarpit` for production
4. Optional nightly: `--max-friction` + REA default-budget timeout test (see `REPORT.md`)