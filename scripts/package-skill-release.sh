#!/usr/bin/env bash
# Build anti-rea-superblue-skill.zip for GitHub Releases (skill + install helpers only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${1:-${ARS_REF:-v0.4.1}}"
OUT="$ROOT/dist"
STAGE="$OUT/stage"
ZIP="$OUT/anti-rea-superblue-skill-${VER}.zip"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE/.cursor/skills" "$STAGE/scripts"

cp -R "$ROOT/.cursor/skills/anti-rea-superblue" "$STAGE/.cursor/skills/"
cp "$ROOT/scripts/install-cursor-skill.sh" "$ROOT/scripts/verify-skill-install.sh" \
   "$ROOT/scripts/detect-toolchain.mjs" "$ROOT/scripts/generate-oracle.mjs" \
   "$ROOT/scripts/skill-intake.mjs" "$STAGE/scripts/"

cat > "$STAGE/README-SKILL-BUNDLE.txt" <<EOF
Anti-ReA Skill: SuperBlue (${VER})

1. Unzip into your app repo root (merges .cursor/skills and scripts/).
2. Run: bash scripts/install-cursor-skill.sh
   OR: ARS_REF=${VER} bash scripts/install-cursor-skill.sh
3. bash .anti-rea-superblue/scripts/verify-skill-install.sh
4. Cursor: @anti-rea-superblue — or: node .anti-rea-superblue/scripts/skill-intake.mjs --route auto --json

Full repo: https://github.com/paraldaMeta/anti-rea-superblue
EOF

mkdir -p "$OUT"
(cd "$STAGE" && zip -rq "$ZIP" .)
echo "$ZIP"