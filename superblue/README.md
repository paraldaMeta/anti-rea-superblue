# SuperBlue

**One layered blue-team pipeline against REA-class AI reverse engineering.**
Combines the best idea from each surveyed project into an ordered, *evidence-first*
flow. It raises the cost of automated decompilation and removes real leaks — it
does **not** claim to make anything "unbreakable," and it is honest about what it
cannot do. Defensive use only (protect software you own).

## The pipeline

```
superblue run <target.js> --oracle <oracle.mjs> [--out dir] [--no-tarpit] [--json]
```

| Layer | What it does | Durability | Source of the idea |
| --- | --- | --- | --- |
| **L0 Contain** | Scan for source maps (incl. inline base64), secrets/keys, `.env`/`.git`, debug symbols, high-entropy material. **Decoy-aware**: tells a *real* embedded-source leak from an intentional poison map. Hard-gates on CRITICAL. | **Permanent** — a removed leak cannot be "un-raised" | reaproof, anti-rea-forge |
| **L1 Architect** | Prints the only advice that defeats a *behavioural* rebuilder (Craft Anything-class): move the secret/authorization decision server-side. Not applied automatically — it's a design change. | **Permanent** (architectural) | threat models across DeRea / AREA |
| **L2 Harden** | `esbuild --minify`: mangle locals, drop comments, strip source-map refs, preserve exports — then **verify behavioural equivalence** against your oracle. | **Durable friction** | DeRea (harden + verify) |
| **L3 Tarpit** | Wrap the hardened BLA fork (`bankrupt`). Speed bump for a **default-budget** REA only. | **Weak** — one `--semantic-precision` raise defeats it (measured) | BLA / this repo's fork |
| **Re-scan** | Contain-scan the final artifact; separate real leaks from intentional L3 decoys. | — | — |

### Honest layer economics (measured in this repo)

- **L0 is the load-bearing layer.** If a source map or key leaks, REA just reads the
  original — every later layer is moot. Fix CRITICAL findings first.
- **L2 does not scrub secrets, and does not hide logic/constants.** Minification keeps
  string literals (a hardcoded key survives → `shipped-logic-clean=❌`, an L0 job) and
  it renames *locals* only — the algorithm and every constant stay in clear (a 128-byte
  hardened sample still shows `c^23100)===4660`). L2 is readability friction for large
  codebases, **not** secrecy for small secret logic. Only L1 (server-side) hides a
  constant the client must use. See `ADVERSARIAL-REVIEW.md` F2.
- **L3 is a casual-only speed bump** and it has a cost: BLA's `bankrupt` output embeds
  a **poison (decoy) source map** and decoy tokens. They carry no real source, but a
  generic CI secret/sourcemap scanner cannot tell — so **the L3 artifact will fail
  secret scanners.** Use `--no-tarpit` for a scanner-clean production build.
- **Nothing here stops behavioural cloning.** Craft Anything-class clean-room rebuild
  watches what the app *does* and rebuilds it without reading your code. Only **L1
  (server-side)** addresses that.

## Two recommended modes

- **Production ship:** `--no-tarpit` → L0 gate + L2 mangle + equivalence. Scanner-clean,
  durable readability reduction, verified behaviour.
- **Max friction vs casual REA:** default (adds L3). Expect ~1000× size tax and CI
  secret-scanner noise from the decoys.

## The oracle

Behavioural equivalence needs a caller-supplied oracle (SuperBlue has no Docker-isolated
judge like DeRea; it does in-process differential testing — run only on code you trust):

```js
export const entry = "checkLicense";       // exported function to compare
export function* samples() { yield ["ABC-123"]; /* ... */ }  // arg tuples
export function equals(a, b) { return a === b; }             // optional
```

## What SuperBlue deliberately does NOT include

- **Agent-instruction "barriers"** (antirea L1/L2: writing "REA PROHIBITED" into
  `AGENTS.md`, fake `rea` shims). These are prompt-injection-grade: bypassed by ignoring
  the instruction or moving execution. Keeping them would invite false confidence.
- **Any modeled "token amplification multiplier."** SuperBlue reports only what it
  measures (bytes, identifier reduction, equivalence pass/fail, real vs decoy leaks).

## Status / limits

- JS/ESM artifact path is implemented and tested end-to-end. Native/APK/Python hardening
  (ANTI-REA, anti-rea-forge, DeRea's APK path) are **not** wired in here — on this machine
  Docker was unavailable, so DeRea's isolated regression was replaced by in-process
  differential testing. Treat equivalence as strong differential evidence, not a proof.
