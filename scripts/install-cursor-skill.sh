#!/usr/bin/env bash
# Install Anti-ReA Skill: SuperBlue (Cursor skill) into the current project.
set -euo pipefail
REPO="${BLA_HARDENED_REPO:-https://github.com/paraldaMeta/bla-hardened.git}"
REF="${BLA_HARDENED_REF:-main}"
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

echo ""
echo "Done. In Cursor, use @anti-rea-superblue (Anti-ReA Skill: SuperBlue) — routes in .cursor/skills/anti-rea-superblue/routes.md"