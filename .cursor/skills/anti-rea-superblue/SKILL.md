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

Pin toolchain (recommended for teams): `export BLA_HARDENED_REF=v0.4.0` before install/clone.

## Step 0.5 — Detect capabilities (always)

```bash
node "$BLA_ROOT/scripts/detect-toolchain.mjs" --json
```

- Obey `routeCaps`. If user asked for a blocked route, offer the closest allowed route and explain.
- Print `notes[]` to the user in plain language.
- On **fresh install** or user says 装好了/verify: `bash "$BLA_ROOT/scripts/verify-skill-install.sh"`.

If `blaTarpit.ok` is false: **R1/R3/R4 unchanged**; **R2** → downgrade to R1 `--no-tarpit` unless user installs BLA (see `$BLA_ROOT/REPORT.md`).

## Step 1 — Ask the user (use AskQuestion if available)

Ask **once** unless the user already answered in the same thread:

| Question | Options |
|----------|---------|
| **Route** | See [routes.md](routes.md) — recommend from their app shape |
| **Target** | File, directory, or `dist/` to scan/harden |
| **Gate strictness** | `critical` (default) · `high` · `moderate` |

If they say "无脑 / 你看着办 / playbook / 全自动": run **[AGENT-PLAYBOOK.md](AGENT-PLAYBOOK.md) Mode A**
(`skill-intake.mjs --route auto`) then execute `plan.steps` — do not improvise flags.

## Step 2 — Execute the route playbook

Open [routes.md](routes.md) and run the matching checklist **in order**. Use the shell;
do not skip verification steps. On errors: [failures.md](failures.md).

**R1 oracle (automatic):** unless user supplied an oracle path,

```bash
node "$BLA_ROOT/scripts/generate-oracle.mjs" "$TARGET" "<project>/.superblue-oracles/auto.mjs"
```

Show `entry` + 3 example yields; **one confirmation** from user, then `run`.

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

See [install.md](install.md). Copy-paste prompts (中文): [prompts.zh.md](prompts.zh.md).

Skill source is **this directory** in the bla-hardened repo.