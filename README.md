# bla-hardened

Defensive tooling for **raising cost** against REA-class static/agent reverse engineering — not a cryptographic lock on client-side code.

| Component | Role |
|-----------|------|
| [`superblue/`](superblue/) | L0–L3 pipeline: leak scan, minify, optional tarpit/chaff, relocate scaffold, measured REA regression |
| [`server-lock/`](server-lock/) | L1 authority: license minting, signed tokens, server-only premium logic + attribution (no hack-back) |
| [`sample/`](sample/) | Tiny targets for scan/harden/relocate demos |

## Quick start

```bash
node superblue/src/index.mjs scan sample/license.js
node superblue/src/index.mjs run sample/license.js --oracle superblue/oracles/license.mjs --no-tarpit --out ./superblue-out
node superblue/src/index.mjs relocate sample/license.js --server-lock --out ./relocate-out
cd server-lock && node src/keygen.mjs && node src/server.mjs
```

## Honest limits

- **L0–L3** slow down default-budget REA; raised semantic budgets and behavioural cloning (e.g. Craft-style rebuilders) bypass client layers.
- **Only architecture locks capability**: move secrets and the computation you sell to **server-lock** (or your own authority).
- Use on **software you own**. This repo does **not** implement offensive counter-hacking — attribution and revocation only.

## License

[MIT](LICENSE) — permissive for defensive tooling. Add your own terms of use for shipped products.

See [`superblue/ADVERSARIAL-REVIEW.md`](superblue/ADVERSARIAL-REVIEW.md) for self red-team findings.