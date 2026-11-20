# bla-hardened

Defensive tooling for **raising cost** against REA-class static/agent reverse engineering — not a cryptographic lock on client-side code.

| Component | Role |
|-----------|------|
| [`superblue/`](superblue/) | L0–L3 pipeline: leak scan, minify, optional tarpit/chaff, relocate scaffold, measured REA regression |
| [`server-lock/`](server-lock/) | L1 authority: license minting, signed tokens, server-only premium logic + attribution (no hack-back) |
| [`sample/`](sample/) | Tiny targets for scan/harden/relocate demos |

## Anti-ReA Skill: SuperBlue

不想记 CLI 时，把 Skill 装进你自己的项目，对话里 **`@anti-rea-superblue`**，选路线即可：

| 路线 | 含义 |
|------|------|
| **R0** | 只扫描泄漏 |
| **R1** | 生产构建（`--no-tarpit`） |
| **R2** | REA 摩擦实验 |
| **R3** | server-lock 真锁 |
| **R4** | 真锁 + 瘦客户端加固 |

**安装（在你要保护的应用仓库根目录执行）：**

```bash
# pinned release (recommended)
BLA_HARDENED_REF=v0.4.2 curl -fsSL https://raw.githubusercontent.com/paraldaMeta/bla-hardened/main/scripts/install-cursor-skill.sh | bash
bash .bla-hardened/scripts/verify-skill-install.sh
```

一键话术：[`prompts.zh.md`](.cursor/skills/anti-rea-superblue/prompts.zh.md)

详情：[`.cursor/skills/anti-rea-superblue/install.md`](.cursor/skills/anti-rea-superblue/install.md)

## Quick start (CLI)

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