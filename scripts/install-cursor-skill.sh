#!/usr/bin/env bash
# Install anti-rea-protect Cursor skill into the current project.
set -euo pipefail
REPO="${BLA_HARDENED_REPO:-https://github.com/paraldaMeta/bla-hardened.git}"
REF="${BLA_HARDENED_REF:-main}"
ROOT="$(pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Fetching skill from $REPO ($REF)..."
git clone --depth 1 --branch "$REF" "$REPO" "$TMP"

mkdir -p "$ROOT/.cursor/skills"
rm -rf "$ROOT/.cursor/skills/anti-rea-protect"
cp -R "$TMP/.cursor/skills/anti-rea-protect" "$ROOT/.cursor/skills/anti-rea-protect"

if [[ ! -f "$ROOT/.bla-hardened/superblue/src/index.mjs" ]]; then
  echo "→ Cloning toolchain to .bla-hardened/ ..."
  git clone --depth 1 --branch "$REF" "$REPO" "$ROOT/.bla-hardened"
else
  echo "→ .bla-hardened/ already present, skipping clone."
fi

if ! grep -q '\.bla-hardened' "$ROOT/.gitignore" 2>/dev/null; then
  {
    echo ""
    echo "# bla-hardened toolchain (anti-rea-protect)"
    echo ".bla-hardened/"
    echo ".superblue-out/"
    echo "server-lock/secrets/"
  } >> "$ROOT/.gitignore"
  echo "→ Appended suggested entries to .gitignore"
fi

echo ""
echo "Done. In Cursor, use @anti-rea-protect and pick a route (see .cursor/skills/anti-rea-protect/routes.md)."