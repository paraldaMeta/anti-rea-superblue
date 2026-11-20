# DeRea / REA regression campaign

SuperBlue treats REA as an **adversary with a budget**, not a magic oracle.

## What we measure

- `superblue test-rea <dir>` runs **default** REA semantic budget vs optional **raised** (`--semantic-precision` class).
- Results land in `rea-test-out/rea-regression.json` with elapsed time, timeout, and output size.

## How to use in your org

1. **Baseline** — After each release candidate build, archive `rea-regression.json` next to the build id.
2. **Gate** — Fail CI on L0 critical leaks; do **not** fail on REA timeout alone (attackers can raise budgets).
3. **Trend** — Track median `defaultBudget.elapsedMs`; regressions often mean accidental secret reintroduction or smaller attack surface removed.
4. **Honesty** — Document when raised budget succeeds; that is the expected bypass for client-only defenses.

## Scheduled job

GitHub Actions workflow `superblue-rea` (weekly / manual) runs `test-rea` on the sample hardened artifact when `REA_ENABLED=true` and Node 24+ is available.