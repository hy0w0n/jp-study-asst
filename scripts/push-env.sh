#!/usr/bin/env bash
# .env.local의 변수를 Vercel 프로젝트의 production·preview·development에 등록한다.
# 값은 표준 입력으로만 넘기고 화면에 출력하지 않는다. 다시 실행하면 덮어쓴다(--force).
# 사용: bash scripts/push-env.sh  (먼저 npx vercel link로 프로젝트가 연결돼 있어야 함)
set -uo pipefail

ENV_FILE="${1:-.env.local}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE 파일이 없습니다." >&2
  exit 1
fi

fail=0
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  case "$line" in ''|\#*) continue ;; esac
  line="${line#export }"
  name="${line%%=*}"
  [ "$name" = "$line" ] && continue
  value="${line#*=}"

  # VERCEL_OIDC_TOKEN 같은 Vercel 자동 변수는 건너뛴다
  case "$name" in VERCEL_*) continue ;; esac
  [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

  # 값을 감싼 따옴표 제거
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi
  if [ -z "$value" ]; then
    echo "⏭  $name: 값이 비어 있어 건너뜀"
    continue
  fi

  for env in production preview development; do
    # 공개 변수·설정값과 development는 Config, 나머지 키는 Secret으로 저장
    if [[ "$name" == NEXT_PUBLIC_* || "$name" == ANTHROPIC_MODEL || "$env" == development ]]; then
      kind="--no-sensitive"
    else
      kind="--sensitive"
    fi
    if printf '%s' "$value" | npx vercel env add "$name" --environment "$env" "$kind" --force --yes >/dev/null 2>&1; then
      echo "✅ $name → $env"
    else
      echo "❌ $name → $env (등록 실패)"
      fail=1
    fi
  done
done < "$ENV_FILE"

exit "$fail"
