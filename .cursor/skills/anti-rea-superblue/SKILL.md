---
name: anti-rea-superblue
description: >-
  Anti-ReA Skill: SuperBlue — run the bla-hardened pipeline (SuperBlue L0–L3 + server-lock)
  on the user's project with route presets R0–R4. Use for anti-REA hardening, reverse-engineering
  friction, server-side license lock, Craft clone resistance, or when the user mentions
  @anti-rea-superblue, Anti-ReA Skill, SuperBlue, or bla-hardened.
disable-model-invocation: true
---

# Anti-ReA Skill: SuperBlue

Powered by [bla-hardened](https://github.com/paraldaMeta/bla-hardened) (SuperBlue + server-lock).

**Read this skill end-to-end once per task.** The user should only pick a **route** and
**target**; you run commands, copy artifacts, and report honestly.

## Non‑negotiables

- Client obfuscation is **not** a lock. Only **L1 (server-side capability)** is architectural.
- Never promise "unbreakable." Cite measured limits: raised REA budgets, behavioural cloning.
- **No hack-back.** Attribution, honeytokens, revoke, signed reports only.
- Only protect software the user **owns** or is authorized to harden.
- Never commit `server-lock/secrets/`, `.env`, or private keys.

## Step 0 — Resolve toolchain root

Tooling lives in the **bla-hardened** repo, not inside this skill folder.

Resolve `BLA_ROOT` in order:

1. Workspace already contains `superblue/src/index.mjs` → `BLA_ROOT` = repo root.
2. Else `./.bla-hardened/superblue/src/index.mjs` exists → `BLA_ROOT=./.bla-hardened`.
3. Else run bootstrap (from the **user's project root**, not BLA_ROOT):

```bash
test -f .bla-hardened/superblue/src/index.mjs || \
  git clone --depth 1 https://github.com/paraldaMeta/bla-hardened.git .bla-hardened
```

Set `SB="node $BLA_ROOT/superblue/src/index.mjs"`. Require **Node ≥ 20** (22+ for full BLA tarpit).

Full L2/L3 needs `bla-agents` or the hardened fork — see `$BLA_ROOT/REPORT.md`. If missing,
still run **L0 scan**, **relocate --server-lock**, and **server-lock** demos.

## Step 1 — Ask the user (use AskQuestion if available)

Ask **once** unless the user already answered in the same thread:

| Question | Options |
|----------|---------|
| **Route** | See [routes.md](routes.md) — recommend from their app shape |
| **Target** | File, directory, or `dist/` to scan/harden |
| **Gate strictness** | `critical` (default) · `high` · `moderate` |

If they say "无脑 / 你看着办": default **R1 production-ship** on their main JS entry if
backend exists; if **no backend**, default **R0 audit** then explain **R3** needs a server.

## Step 2 — Execute the route playbook

Open [routes.md](routes.md) and run the matching checklist **in order**. Use the shell;
do not skip verification steps.

After any `run`, read `$OUT/report.json` and `$BLA_ROOT/superblue/ADVERSARIAL-REVIEW.md`
if the user asks whether they are "safe."

## Step 3 — Integrate server-lock (routes R3/R4 only)

- Copy `$BLA_ROOT/server-lock` → `<project>/server-lock` (merge, do not overwrite secrets).
- `node server-lock/src/keygen.mjs` once per environment.
- `superblue relocate <their-module> --server-lock` writes `logic-relocated.mjs` + thin client.
- Wire their app to the generated `*.client.mjs`; run `node server-lock/src/demo.mjs`.

Framework mount points: [recipes.md](recipes.md).

## Step 4 — Close with an honest summary

Template:

```markdown
## Done — route {R?}
- Toolchain: {BLA_ROOT}
- Layers applied: {list}
- Gate: {pass/fail} ({block-level})
- Lock: {yes/no — server URL + what moved server-side}
- Still bypassable by: {raised REA budget / Craft / offline patch of UX-only checks}
- Next: {one concrete action}
```

## Install this skill (for humans)

See [install.md](install.md). Skill source is **this directory** in the bla-hardened repo.