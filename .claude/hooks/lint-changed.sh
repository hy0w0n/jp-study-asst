#!/usr/bin/env bash
# PostToolUse(Edit|Write): 방금 고친 TS/JS 파일만 ESLint. 오류가 있으면 exit 2 → stderr가 Claude에게 전달되어 바로 고친다.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$HERE/../.." && pwd)}"
INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | node "$HERE/_json.js" tool_input.file_path)"
[ -z "$FILE" ] && FILE="$(printf '%s' "$INPUT" | node "$HERE/_json.js" tool_input.path)"
[ -z "$FILE" ] && exit 0
case "$FILE" in *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;; *) exit 0 ;; esac
case "$FILE" in *node_modules/*|*/.next/*) exit 0 ;; esac
[ -f "$FILE" ] || exit 0
cd "$ROOT" || exit 0
[ -f node_modules/.bin/eslint ] || exit 0
OUT="$(node_modules/.bin/eslint --max-warnings=0 "$FILE" 2>&1)"
CODE=$?
if [ "$CODE" -ne 0 ]; then
  printf '%s\n' "$OUT" | tail -40 >&2
  printf '\nESLint 실패: %s — 위 문제를 지금 고친 뒤 계속해.\n' "$FILE" >&2
  exit 2
fi
exit 0
