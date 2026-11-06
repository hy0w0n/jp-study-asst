#!/usr/bin/env bash
# SessionStart: 세션 시작 시 현재 브랜치·미커밋 변경·열린 이슈 요약을 컨텍스트로 넣는다 (stdout 평문 = 컨텍스트).
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$HERE/../.." && pwd)}"
cd "$ROOT" || exit 0
cat >/dev/null  # stdin 비우기
echo "[프로젝트 상태 — SessionStart 훅]"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "브랜치: $(git branch --show-current 2>/dev/null) · 미커밋 변경: $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')개"
  echo "최근 커밋:"; git log --oneline -3 2>/dev/null | sed 's/^/  /'
fi
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "열린 이슈(최대 8):"
  gh issue list --state open --limit 8 2>/dev/null | sed 's/^/  /' || true
fi
if [ -f docs/ROADMAP.md ]; then
  echo "로드맵 현재 단계: $(grep -m1 '현재 단계' docs/ROADMAP.md 2>/dev/null | sed 's/^[#> ]*//')"
fi
echo "규칙: 작업은 이슈 단위 브랜치 → PR. 끝내기 전 npm run check. 자세한 건 AGENTS.md와 .claude/skills/."
exit 0
