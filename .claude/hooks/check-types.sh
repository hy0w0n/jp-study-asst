#!/usr/bin/env bash
# Stop / TaskCompleted: src 아래에 커밋되지 않은 변경이 있을 때만 `tsc --noEmit`.
# 같은 변경 내용으로 한 번 통과했으면(스탬프) 건너뛴다. 실패하면 exit 2로 "끝내기 전에 고쳐"라고 알린다.
# Stop에서는 stop_hook_active=true(이미 훅 때문에 이어가는 중)면 무한 루프를 막기 위해 통과시킨다.
set -u
MODE="${1:-stop}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$HERE/../.." && pwd)}"
INPUT="$(cat)"
if [ "$MODE" = "stop" ]; then
  ACTIVE="$(printf '%s' "$INPUT" | node "$HERE/_json.js" stop_hook_active)"
  [ "$ACTIVE" = "true" ] && exit 0
fi
cd "$ROOT" || exit 0
[ -f node_modules/.bin/tsc ] || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
# 변경 없음 → 통과
if git diff --quiet HEAD -- src 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard src)" ]; then
  exit 0
fi
STAMP_DIR="$ROOT/.claude"
STAMP="$STAMP_DIR/.tsc-ok"
SUM="$( { git diff HEAD -- src; git ls-files --others --exclude-standard src | while IFS= read -r f; do cat "$f"; done; } 2>/dev/null | git hash-object --stdin 2>/dev/null )"
if [ -n "$SUM" ] && [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$SUM" ]; then
  exit 0
fi
OUT="$(node_modules/.bin/tsc --noEmit 2>&1)"
CODE=$?
if [ "$CODE" -ne 0 ]; then
  printf '%s\n' "$OUT" | tail -30 >&2
  if [ "$MODE" = "task" ]; then
    printf '\n타입 오류가 남아 있어 작업을 완료 처리할 수 없어. 고친 뒤 다시 완료해.\n' >&2
  else
    printf '\n타입 오류가 남아 있어. 끝내기 전에 고쳐.\n' >&2
  fi
  exit 2
fi
mkdir -p "$STAMP_DIR" && printf '%s' "$SUM" > "$STAMP"
exit 0
