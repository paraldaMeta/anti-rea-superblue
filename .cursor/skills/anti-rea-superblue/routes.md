# Anti-ReA Skill: SuperBlue — routes & intensity

Pick **one route** per request. Intensity is baked into the route (not a separate BLA knob
unless user overrides).

## Route picker

| Route | When to use | What you do | Honest expectation |
|-------|-------------|-------------|---------------------|
| **R0 audit** | First look, CI gate, no code changes | `scan` only | Finds self-inflicted leaks |
| **R1 production-ship** | Shipping JS/Electron bundle | `scan` → `run --no-tarpit` + oracle | Scanner-clean, minify friction only |
| **R2 friction-lab** | Internal REA cost experiment | `run --max-friction`, optional `test-rea` | Beaten by raised REA budget |
| **R3 server-lock** | Real lock / licensing / premium API | `relocate --server-lock` + vendor `server-lock/` | Stops static + Craft **if** capability is server-only |
| **R4 full-stack** | SaaS / licensed desktop with bundle | **R3** then **R1** on thin client | Moat on client + lock on server |

**No backend / static-only product:** cannot do R3/R4 without adding Workers/Lambda/etc.
Say so before scaffolding. Offer R0+R1 on assets only.

---

## R0 — audit

```bash
export BLA_ROOT=...  # see SKILL.md
SB="node $BLA_ROOT/superblue/src/index.mjs"
TARGET="<user-path>"

$SB scan "$TARGET" --block-level ${GATE:-critical} --json
```

- Exit **2** → list CRITICAL/HIGH findings; fix leaks before R1/R2.
- Exit **0** → say "no blocking leaks at this gate level" (not "secure").

---

## R1 — production-ship

Prereq: user supplies **oracle** (exported fn + `samples()`). If none, generate a minimal
`oracles/<name>.mjs` from their exports and confirm with user.

```bash
OUT="<project>/.superblue-out"
ORACLE="<path-to-oracle.mjs>"
TARGET="<entry.js>"

$SB scan "$TARGET" --block-level critical || exit 2
$SB run "$TARGET" --oracle "$ORACLE" --no-tarpit --out "$OUT" \
  --block-level critical --chaff-level heavy
$SB scan "$OUT/shipped" --block-level critical
```

Deliverables to mention: `$OUT/report.json`, `POLICY.json`, `CLIENT-CONSTITUTION.md`.

Optional Electron: `$SB run ... --profile electron` and
`node $BLA_ROOT/superblue/scripts/check-electron-fuses.mjs`.

---

## R2 — friction-lab

```bash
OUT="<project>/.superblue-friction"
$SB run "$TARGET" --oracle "$ORACLE" --max-friction --out "$OUT"
$SB test-rea "$OUT/shipped" --skip-raised --out "$OUT/rea"
```

Warn: poison maps fail generic secret scanners; **do not** ship R2 artifact to prod.
Point user to `DEREA-CAMPAIGN.md` at repo root.

---

## R3 — server-lock

1. Identify the **valuable function** (license check alone is weak; **premium compute** is strong).
2. Ensure module uses simple `export function name(...)` (else hand-edit `logic-relocated.mjs`).

```bash
$SB relocate "$MODULE" --server-lock --out "<project>/relocate-out"
cp -R "$BLA_ROOT/server-lock" "<project>/server-lock"   # skip if exists; never copy secrets/
cd "<project>/server-lock" && node src/keygen.mjs
node src/demo.mjs
node src/trace-demo.mjs   # if user asked attribution / honeytokens
```

`premiumTransform` loads `logic-relocated.mjs` via `relocate-bridge.mjs` automatically.

User must set `API_BASE` / deploy server. Recipes: [recipes.md](recipes.md).

---

## R4 — full-stack

Run **R3** first. Then **R1** on `relocate-out/<fn>.client.mjs` (thin client), not the original module.

Verify: scan thin client → 0 secrets; `demo.mjs` attacks fail; server holds logic.

---

## Gate strictness (all routes with scan)

| Level | Use when |
|-------|----------|
| `critical` | Default production |
| `high` | Stricter pre-release |
| `moderate` | Noisy trees; dev only |

---

## User phrase → route

| User says | Route |
|-----------|-------|
| "扫一下有没有泄漏" | R0 |
| "上线版 / 生产" | R1 |
| "尽量拖慢 REA / 实验" | R2 |
| "真锁 / 防克隆 / license 不能扒" | R3 or R4 |
| "全都要" | R4 if backend possible, else R0+R1 + honest R3 blocker |