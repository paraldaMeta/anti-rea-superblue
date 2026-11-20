#!/usr/bin/env bash
# Install Anti-ReA Skill: SuperBlue (Cursor skill) into the current project.
set -euo pipefail
REPO="${BLA_HARDENED_REPO:-https://github.com/paraldaMeta/bla-hardened.git}"
REF="${BLA_HARDENED_REF:-v0.4.2}"
ROOT="$(pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Fetching skill from $REPO ($REF)..."
git clone --depth 1 --branch "$REF" "$REPO" "$TMP"

mkdir -p "$ROOT/.cursor/skills"
rm -rf "$ROOT/.cursor/skills/anti-rea-superblue"
cp -R "$TMP/.cursor/skills/anti-rea-superblue" "$ROOT/.cursor/skills/anti-rea-superblue"

if [[ ! -f "$ROOT/.bla-hardened/superblue/src/index.mjs" ]]; then
  echo "→ Cloning toolchain to .bla-hardened/ ..."
  git clone --depth 1 --branch "$REF" "$REPO" "$ROOT/.bla-hardened"
else
  echo "→ .bla-hardened/ already present, skipping clone."
fi

if ! grep -q '\.bla-hardened' "$ROOT/.gitignore" 2>/dev/null; then
  {
    echo ""
    echo "# bla-hardened toolchain (Anti-ReA Skill: SuperBlue)"
    echo ".bla-hardened/"
    echo ".superblue-out/"
    echo "server-lock/secrets/"
  } >> "$ROOT/.gitignore"
  echo "→ Appended suggested entries to .gitignore"
fi

echo "→ verify-skill-install"
bash "$ROOT/.bla-hardened/scripts/verify-skill-install.sh" 2>/dev/null || bash "$ROOT/scripts/verify-skill-install.sh" 2>/dev/null || echo "(skip verify — run scripts/verify-skill-install.sh manually)"

echo ""
echo "Done. In Cursor: @anti-rea-superblue — routes: .cursor/skills/anti-rea-superblue/routes.md"
echo "Pinned ref: $REF (override with BLA_HARDENED_REF=...)"