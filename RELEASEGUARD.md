# Release guard checklist

Before shipping a client binary or JS bundle:

1. **L0 gate** — `superblue scan <artifact-dir> --block-level critical` → exit 0.
2. **Strip dist hygiene** — `superblue strip-dist <distDir>` (remove poison maps / debug URLs for production).
3. **Ship profile** — `superblue run ... --no-tarpit` for production; L3 only for intentional friction builds.
4. **L1** — If any secret or premium logic remains client-side, run `relocate --server-lock` and ship the thin client only.
5. **Electron** (if applicable) — `node superblue/scripts/check-electron-fuses.mjs` + `--profile electron` notes.
6. **REA spot-check** — `superblue test-rea <artifact-dir> --skip-raised` in CI; full raised-budget run weekly (see workflow).

Never commit `server-lock/secrets/` or per-customer honeytoken lists.