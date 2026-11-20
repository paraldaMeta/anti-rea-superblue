# Anti-ReA Skill: SuperBlue — 一键话术（复制到 Cursor）

前缀可加：`@anti-rea-superblue`

| 场景 | 复制这句 |
|------|-----------|
| 先看看有没有泄漏 | `路线 R0，目标 <路径>，门禁 critical` |
| 生产发货（默认） | `路线 R1 生产，目标 <入口.js>，你自动写 oracle 我确认后跑` |
| REA 摩擦实验 | `路线 R2，目标 <入口.js>，缺 BLA 就告诉我降级方案` |
| 强度 8（推荐） | `强度8 playbook 全自动，target <module.js>` |
| 真锁 / 防克隆 | `路线 R3，把 <module.js> relocate 到 server-lock，我有 Node 后端` |
| 全栈 | `路线 R4，模块 <x.js>，后端 localhost:8787，再加固瘦客户端` |
| 完全无脑 | `playbook 全自动：skill-intake --route auto --target <路径>，按 plan 逐步执行` |
| Subagent | `用 AGENT-PLAYBOOK Mode B 起一个子 agent 跑完整流程` |
| 装完自检 | `跑 verify-skill-install，把结果用人话总结` |

**强度口令（叠加在路线上）：**

- `门禁 high` → scan 更严  
- `只要 server-lock 不要 tarpit` → 等价 R3 或 R1 `--no-tarpit`  
- `Electron` → R1 + profile electron + fuse 检查  

安装后版本 pin（可选）：

```bash
BLA_HARDENED_REF=v0.4.0 curl -fsSL .../install-cursor-skill.sh | bash
```