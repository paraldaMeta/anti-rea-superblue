# Agent playbook (9.5+ — full autopilot)

Use when the user says: **全自动 / playbook / 跑一遍 / 无脑 / intake**.

## Mode A — Single script (preferred)

```bash
export BLA_ROOT="${BLA_ROOT:-.bla-hardened}"
node "$BLA_ROOT/scripts/skill-intake.mjs" --route auto --target "<path-or-empty>" --json
```

1. Parse JSON `plan.steps[]` in order.
2. If `downgraded: true`, tell the user why before executing.
3. Steps with `confirm: true` → show oracle head, **one user OK**, then continue.
4. On failure → open [failures.md](failures.md), branch, resume.

## Mode B — Subagent (heavy / monorepo)

Launch **one** `generalPurpose` subagent with this description (fill placeholders):

```text
Task: Anti-ReA Skill: SuperBlue playbook

Full Repository Path: <absolute project path>
BLA_ROOT: <.bla-hardened or repo root>

1. Run: node "$BLA_ROOT/scripts/skill-intake.mjs" --route auto --target "<TARGET>" --json
2. Execute every step in plan.steps where required=true; respect confirm gates.
3. On error, read $BLA_ROOT/.cursor/skills/anti-rea-superblue/failures.md and fix or stop with honest limits.
4. Close with the SKILL.md summary template (route, layers, gate, lock, still bypassable, next).

User route preference: <auto|R0|R1|R2|R3|R4>
Gate: <critical|high|moderate>
Target: <file or dist path or "discover">
```

Do **not** spawn chained subagents. Return one final report.

## Mode C — Install + verify only

```bash
BLA_HARDENED_REF=v0.4.1 curl -fsSL .../install-cursor-skill.sh | bash
```

Then Mode A with `--target` empty → expect **R0** on sample inside BLA_ROOT.

## User never needs to name CLI flags

They only provide: **route letter (optional)**, **target path (optional)**, **有无后端 (optional)**.
You run intake + steps.