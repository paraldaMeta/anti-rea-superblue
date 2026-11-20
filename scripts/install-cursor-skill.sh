#!/usr/bin/env bash
# Install Anti-ReA Skill: SuperBlue (Cursor skill) into the current project.
set -euo pipefail
REPO="${ARS_REPO:-https://github.com/paraldaMeta/anti-rea-superblue.git}"
REF="${ARS_REF:-${BLA_HARDENED_REF:-v0.4.3}}"
ROOT="$(pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Fetching skill from $REPO ($REF)..."
git clone --depth 1 --branch "$REF" "$REPO" "$TMP"

mkdir -p "$ROOT/.cursor/skills"
rm -rf "$ROOT/.cursor/skills/anti-rea-superblue"
cp -R "$TMP/.cursor/skills/anti-rea-superblue" "$ROOT/.cursor/skills/anti-rea-superblue"

if [[ -d "$ROOT/.bla-hardened" && ! -d "$ROOT/.anti-rea-superblue" ]]; then
  echo "→ Renaming legacy .bla-hardened/ → .anti-rea-superblue/"
  mv "$ROOT/.bla-hardened" "$ROOT/.anti-rea-superblue"
fi

if [[ ! -f "$ROOT/.anti-rea-superblue/superblue/src/index.mjs" ]]; then
  echo "→ Cloning toolchain to .anti-rea-superblue/ ..."
  git clone --depth 1 --branch "$REF" "$REPO" "$ROOT/.anti-rea-superblue"
else
  echo "→ .anti-rea-superblue/ already present, skipping clone."
fi

if ! grep -q '\.anti-rea-superblue' "$ROOT/.gitignore" 2>/dev/null; then
  {
    echo ""
    echo "# anti-rea-superblue toolchain (Anti-ReA Skill: SuperBlue)"
    echo ".anti-rea-superblue/"
    echo ".bla-hardened/"
    echo ".superblue-out/"
    echo "server-lock/secrets/"
  } >> "$ROOT/.gitignore"
  echo "→ Appended suggested entries to .gitignore"
fi

echo "→ verify-skill-install"
bash "$ROOT/.anti-rea-superblue/scripts/verify-skill-install.sh" 2>/dev/null || bash "$ROOT/scripts/verify-skill-install.sh" 2>/dev/null || echo "(skip verify — run scripts/verify-skill-install.sh manually)"

echo ""
echo "Done. In Cursor: @anti-rea-superblue — routes: .cursor/skills/anti-rea-superblue/routes.md"
echo "Pinned ref: $REF (override with ARS_REF=...)"