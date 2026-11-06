#!/usr/bin/env bash
# PreToolUse(Bash): 명령이 `git commit`(또는 gh pr merge)이면 그 전에 lint → typecheck → vitest(설치돼 있을 때)를 돌린다.
# 실패하면 exit 2 → 커밋이 막히고 stderr가 Claude에게 전달된다.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$HERE/../.." && pwd)}"
INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | node "$HERE/_json.js" tool_input.command)"
case "$CMD" in
  *"git commit"*|*"gh pr merge"*) ;;
  *) exit 0 ;;
esac
cd "$ROOT" || exit 0
[ -f package.json ] || exit 0
fail() { printf '%s\n' "$2" | tail -60 >&2; printf '\n%s 실패 — 커밋을 막았어. 고친 뒤 다시 커밋해.\n' "$1" >&2; exit 2; }
if [ -f node_modules/.bin/eslint ]; then
  OUT="$(npm run --silent lint 2>&1)" || fail "lint" "$OUT"
fi
if [ -f node_modules/.bin/tsc ]; then
  OUT="$(node_modules/.bin/tsc --noEmit 2>&1)" || fail "typecheck" "$OUT"
fi
if [ -f node_modules/.bin/vitest ]; then
  OUT="$(node_modules/.bin/vitest run --passWithNoTests 2>&1)" || fail "vitest" "$OUT"
fi
exit 0
