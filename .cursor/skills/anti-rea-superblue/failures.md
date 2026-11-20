# Failure & edge playbooks

Agent: when a step fails, branch here. Do not retry the same command more than twice
without new evidence.

## `detect-toolchain` → route blocked

| Signal | Action |
|--------|--------|
| `routeCaps.R1` false | Stop hardening; ask user to install Node 20+. |
| `esbuild.ok` false | R1 still OK with strip-only; warn mangling skipped; suggest `npm i -D esbuild` in user or BLA_ROOT project. |
| `blaTarpit.ok` false | **Do not** promise R2; offer R1 `--no-tarpit` or R0 only. |
| User asked R2 anyway | Run R1 first, explain L3 skipped; optional `test-rea` only if artifact exists. |

Always run: `node $BLA_ROOT/scripts/detect-toolchain.mjs --json` before route execution.

## `scan` exit 2

1. Print blocking findings with paths.
2. If route is R1/R2: **stop** until CRITICAL fixed or user explicitly lowers gate (document risk).
3. If route is R0: deliver report as success (found issues).

## `generate-oracle` exit 2

- No `export function` shape → read file, ask user for entry name OR hand-write `oracles/manual.mjs` from template in recipes.md.
- User confirms auto oracle **once** before `run` (show `entry` + first 5 sample lines).

## `run` failure

| Error | Action |
|-------|--------|
| Oracle mismatch / equiv fail | Show mismatch sample; do not ship; fix logic or expand oracle. |
| BLA / tarpit error | Re-run with `--no-tarpit` (R1 default anyway). |
| Timeout in verify worker | Increase `--timeout-ms`; if target has side effects, stop and warn. |

## `relocate --server-lock` failure

- Complex exports (classes, re-exports) → manual `logic-relocated.mjs`; still copy server-lock skeleton.
- No backend in project → stop R3; offer Cloudflare Workers recipe or R0+R1 only.

## Monorepo / TypeScript

1. **Scan** shipped `dist/` or bundle output, not raw TS, unless user insists.
2. **R1 target** must be a runnable `.js` entry (or ask user for build command first).
3. **R3** module must be simple ESM `.js` or transpiled output.

## After install

Run `bash $BLA_ROOT/scripts/verify-skill-install.sh` when user says "装好了" or route is unclear.