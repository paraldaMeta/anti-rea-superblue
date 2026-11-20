# Anti-ReA Skill: SuperBlue — install

This Cursor skill ships inside [bla-hardened](https://github.com/paraldaMeta/bla-hardened) at
`.cursor/skills/anti-rea-superblue/`. It runs SuperBlue + server-lock on **your** repo.

## Option A — One command (recommended)

From **your app project root**:

```bash
curl -fsSL https://raw.githubusercontent.com/paraldaMeta/bla-hardened/main/scripts/install-cursor-skill.sh | bash
```

Copies the skill to `.cursor/skills/anti-rea-superblue/` and clones `.bla-hardened/` if needed.

## Option B — Copy skill only

```bash
mkdir -p .cursor/skills
git clone --depth 1 https://github.com/paraldaMeta/bla-hardened.git /tmp/bla-hardened
cp -R /tmp/bla-hardened/.cursor/skills/anti-rea-superblue .cursor/skills/
rm -rf /tmp/bla-hardened
```

## Option C — Submodule

```bash
git submodule add https://github.com/paraldaMeta/bla-hardened.git .bla-hardened
mkdir -p .cursor/skills
cp -R .bla-hardened/.cursor/skills/anti-rea-superblue .cursor/skills/
```

## Use in Cursor

1. Open your project.
2. Chat: **`@anti-rea-superblue`** or e.g. `Anti-ReA Skill：路线 R1，目标 dist/`。
3. Pick route + target when asked.

| Path | Purpose |
|------|---------|
| `.cursor/skills/anti-rea-superblue/` | This skill |
| `.bla-hardened/` | Toolchain clone |
| `.superblue-out/` | R1/R2 outputs (gitignore) |
| `server-lock/` | Your project copy (R3/R4) |