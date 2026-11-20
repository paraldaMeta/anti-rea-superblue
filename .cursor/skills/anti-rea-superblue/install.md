# Anti-ReA Skill: SuperBlue — install

This Cursor skill ships inside [anti-rea-superblue](https://github.com/paraldaMeta/anti-rea-superblue) at
`.cursor/skills/anti-rea-superblue/`. It runs SuperBlue + server-lock on **your** repo.

## Option A — One command (recommended)

From **your app project root**:

```bash
curl -fsSL https://raw.githubusercontent.com/paraldaMeta/anti-rea-superblue/main/scripts/install-cursor-skill.sh | bash
```

Copies the skill to `.cursor/skills/anti-rea-superblue/` and clones `.anti-rea-superblue/` if needed (default **v0.4.3**).

## Option D — GitHub Release zip

Download `anti-rea-superblue-skill-vX.Y.Z.zip` from [Releases](https://github.com/paraldaMeta/anti-rea-superblue/releases),
unzip at your project root, then:

```bash
ARS_REF=v0.4.3 bash scripts/install-cursor-skill.sh
```

Verify:

```bash
bash .anti-rea-superblue/scripts/verify-skill-install.sh
# or from inside bla-hardened repo:
bash scripts/verify-skill-install.sh
```

Chinese copy-paste prompts: [prompts.zh.md](prompts.zh.md).

## Option B — Copy skill only

```bash
mkdir -p .cursor/skills
git clone --depth 1 https://github.com/paraldaMeta/anti-rea-superblue.git /tmp/anti-rea-superblue
cp -R /tmp/anti-rea-superblue/.cursor/skills/anti-rea-superblue .cursor/skills/
rm -rf /tmp/anti-rea-superblue
```

## Option C — Submodule

```bash
git submodule add https://github.com/paraldaMeta/anti-rea-superblue.git .anti-rea-superblue
mkdir -p .cursor/skills
cp -R .anti-rea-superblue/.cursor/skills/anti-rea-superblue .cursor/skills/
```

## Use in Cursor

1. Open your project.
2. Chat: **`@anti-rea-superblue`** or e.g. `Anti-ReA Skill：路线 R1，目标 dist/`。
3. Pick route + target when asked.

| Path | Purpose |
|------|---------|
| `.cursor/skills/anti-rea-superblue/` | This skill |
| `.anti-rea-superblue/` | Toolchain clone |
| `.superblue-out/` | R1/R2 outputs (gitignore) |
| `server-lock/` | Your project copy (R3/R4) |