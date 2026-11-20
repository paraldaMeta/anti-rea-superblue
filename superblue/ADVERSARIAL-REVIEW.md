# SuperBlue — adversarial review (self red-team)

I attacked my own pipeline. Findings, worst first. Each is reproduced with a real
command/artifact in this repo, not asserted.

## FIXED during this review

### F1 · CRITICAL — L0 decoy classifier could be silenced by keyword-sprinkling
The "decoy-aware" source-map classifier downgraded any map containing poison
markers (e.g. `enclave_build_id`) to a harmless "MODERATE decoy". Attack: append
one poison word to a map that embeds the **real** source → a genuine full-source
leak was reported as safe (`critical=0`). That is the exact attacker-controllable-
marker brittleness I criticized BLA for, and the worst failure mode for a leak
scanner (false negative that hides a real leak).
**Fix:** fail-safe — source-like content always drives severity (CRITICAL); poison
markers are an *annotation* ("CONFIRM it is yours"), never a downgrade.
**Re-tested:** the evasion target now scans `very-high / CRITICAL`.

### F4 · MEDIUM — FIXED: equivalence now runs process-isolated with a timeout
`verify.mjs` no longer `import()`s the candidate in the orchestrator's own process.
It spawns `src/verify-worker.mjs` in a child `node` process (`spawnSync`, `killSignal
SIGKILL`, `NODE_OPTIONS` cleared, default 60s wall-clock timeout, 16 MiB output cap).
A target's import-time side effects / BLA's ~150 KB injected code can no longer touch
the pipeline, and a hang is bounded. **Still sampled, not proven** (see residual note
below), and OS-process isolation is not a security sandbox — run only on code you own.

### F5 · MEDIUM — FIXED: containment gate level is configurable
`--block-level critical|high|moderate` (default `critical`) sets the severity that
fails the build; the gate now evaluates findings at-or-above that rank on both the
original and the shipped L2 output, and the CLI exits `2` when the gate (or an oracle
regression) fails — a usable CI gate. **Proven:** a MODERATE-only target passes at
`critical`/`high` (exit 0) and fails at `moderate` (exit 2); a CRITICAL leak fails at
every level. Entropy detector now also flags non-standard-length long hex (F6) as
MODERATE, so hex-encoded keys are no longer invisible.

## INHERENT / by-design limits (not bugs — honest scope)

### F2 · HIGH — L2 "hardening" does not hide logic or constants
`esbuild --minify` renames locals and drops comments, but the algorithm and every
constant survive. Demonstrated: the hardened 128-byte output is
`function n(t){let c=0;for(...)c=c*31+t.charCodeAt(e)&65535;return(c^23100)===4660}`
— i.e. `0x5a3c` (23100) and `0x1234` (4660) in clear. REA reads minified code
fine. **Minification is readability friction for large codebases, not secrecy for
small secret logic.** You cannot hide a constant the client must compute with;
only L1 (server-side) removes it. README reframed accordingly.

### F3 · HIGH — L3 tarpit is net-negative in common deployments
The poison source map that BLA injects is removed by the attacker in one line
(`sed '/sourceMappingURL=data:/d'`) at ~zero cost, but it reliably **breaks the
defender's own CI secret/sourcemap scanners** and inflates the bundle ~1000×.
Recommendation: **L3 off by default** (`--no-tarpit` is the shippable build); treat
it as opt-in friction against a default-budget REA only, which a single
`--semantic-precision` raise already defeats (measured elsewhere in this repo).

### F4 residual — equivalence is still SAMPLED (process isolation fixed above)
Even process-isolated, `verify.mjs` runs ~4,011 differential samples over an infinite
input space: a behaviour-changing transform could still pass on unsampled inputs.
DeRea's Docker-isolated regression judge is stronger; treat `equiv=✅` as strong
evidence, not a proof. (The in-process/side-effect half of this finding is FIXED.)

### F6 · LOW — scanner blind spots & reproducibility (partially fixed)
- Entropy detector now flags non-standard-length long hex as MODERATE (hex-encoded
  keys no longer invisible); pure standard-length hashes are still ignored by design.
- Files >8 MiB and non-text extensions >512 KiB are skipped → secrets embedded in
  wasm/images/assets are missed.
- The BLA fork uses a per-build random seed → **non-reproducible builds** (a mild
  supply-chain/debuggability downside; confirmed: two builds of one file differ).

### F7 · LOW/trust — dependency & execution surface
SuperBlue depends on the BLA fork (itself a fork of a modeled-numbers tool) and on
esbuild, and auto-executes BLA's ~150 KB injected output in-process during verify.

## Meta-finding (the one that matters)

SuperBlue's durable value is **L0 (remove leaks) + L1 (move secrets server-side)**.
L2 is modest friction; L3 is a casual-only speed bump with real downsides. Honestly
described, the product is "a decoy-aware leak scanner + a minifier + an optional
tarpit, orchestrated with no dishonest multipliers" — not a protection guarantee.
This is consistent with the whole investigation: client-side anti-reverse-
engineering raises cost, it is not a lock. The only lock is architectural.

**L1 is now implemented, not just advised:** see `../server-lock/` — a working
Ed25519 server-authority (license minting + token signing + the valuable compute all
server-side; client ships only a public key). Its `demo.mjs` runs four attacks from
the full-client-source threat model (forge license, forge token, patch the local
gate, clone the client) and all four fail. SuperBlue's own scanner confirms the
shipped client is `baseline / 0 findings`. That is the lock; L0–L3 are the moat.
