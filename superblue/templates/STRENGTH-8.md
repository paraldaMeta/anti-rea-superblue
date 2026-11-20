# Strength tier 8 (operational anti-REA target)

Honest meaning: **~8/10 vs taking capability from the client** — not vs a funded REA lab.

## Required stack

1. **L0** — `scan` critical gate = 0 on ship target and thin client.
2. **L1** — `relocate --server-lock`; premium logic in `logic-relocated.mjs` only.
3. **Ship** — thin client hardened with `run --no-tarpit` only (moat, not tarpit-as-security).
4. **Server** — `STRENGTH_TIER=8` (default): 5 min tokens, 90s challenges, autoban threshold 50.
5. **Verify** — `node scripts/strength-8-check.mjs <target> --json` → score ≥ 8.

## CI (copy to your app repo)

See `ci-gate.yml` in this folder.

## Skill one-liner

`@anti-rea-superblue 强度8，target <module.js>，playbook 全自动`