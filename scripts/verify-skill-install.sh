#!/usr/bin/env bash
# Post-install smoke test for Anti-ReA Skill: SuperBlue
set -euo pipefail
ROOT="$(pwd)"
if [[ -f "$ROOT/superblue/src/index.mjs" ]]; then BLA_ROOT="$ROOT"
elif [[ -f "$ROOT/.anti-rea-superblue/superblue/src/index.mjs" ]]; then BLA_ROOT="$ROOT/.anti-rea-superblue"
elif [[ -f "$ROOT/.bla-hardened/superblue/src/index.mjs" ]]; then BLA_ROOT="$ROOT/.bla-hardened"
else
  echo "FAIL: no .anti-rea-superblue/ or superblue/ — run install-cursor-skill.sh first" >&2
  exit 2
fi

if [[ ! -d "$ROOT/.cursor/skills/anti-rea-superblue" ]]; then
  echo "FAIL: .cursor/skills/anti-rea-superblue missing" >&2
  exit 2
fi

echo "→ detect-toolchain"
node "$BLA_ROOT/scripts/detect-toolchain.mjs" --json | head -40

echo "→ R0 sample scan"
node "$BLA_ROOT/superblue/src/index.mjs" scan "$BLA_ROOT/sample/license.js" --json | head -20

echo "→ generate-oracle draft"
node "$BLA_ROOT/scripts/generate-oracle.mjs" "$BLA_ROOT/sample/license.js" /tmp/superblue-verify-oracle.mjs

echo ""
echo "OK — Anti-ReA Skill: SuperBlue install verified. Use @anti-rea-superblue in Cursor."