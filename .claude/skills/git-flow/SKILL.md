---
name: git-flow
description: Git·GitHub·Vercel 운영(장기). 이슈 단위 브랜치, PR 템플릿·CI·리뷰 게이트, 미리보기 배포에서 UX 점검, 스쿼시 머지, 릴리스 태그, 되돌리기. "브랜치", "PR 만들어", "머지", "배포 확인", "되돌려", "릴리스", "CI 실패" 요청에 사용.
---

# Git Flow v2 (이슈 → 브랜치 → PR → 검증 → 머지)

원칙: **main은 항상 배포 가능**, main에 직접 푸시하지 않는다, 모든 변경은 PR, PR은 CI + 리뷰 게이트를 통과한다. 해커톤 때 건너뛴 "확인" 단계를 구조로 강제한다.

## 처음 한 번
- `main` 보호: **Ruleset "main 보호"로 적용됨**(2026-11-10, Settings → Rules → Rulesets). PR 필수(승인 0 — 혼자라 자기 PR을 승인할 수 없음), 필수 검사 `check`·`e2e`, 강제 푸시·삭제 금지, 스쿼시 머지만. 우회자 없음 — 관리자도 main에 직접 못 올린다
- `.github/pull_request_template.md`(키트)에 체크리스트가 있다. 비워 두고 머지하지 않는다
- Vercel: PR마다 미리보기 URL이 자동으로 달린다. 환경 변수는 Preview에도 설정

## 이슈 하나의 흐름
1. `git switch -c <type>/<이슈번호>-<짧은-이름>` (예: `fix/12-logo-home-link`, `feat/15-handwriting`)
2. 구현: 작은 커밋, 메시지 `<type>: <한국어 요약> (#12)` — type은 feat / fix / data / test / docs / chore / refactor. 훅이 커밋 전 `npm run check`를 돌린다
3. 푸시 → `gh pr create --fill --base main` → 템플릿 체크리스트 채우기 → CI 통과 확인(`gh pr checks --watch`)
4. **리뷰 게이트**: `reviewer` 에이전트에게 PR 리뷰 요청 → P0·P1 고쳐서 푸시. 사용자 화면 변경이면 Vercel 미리보기 URL로 `ux-tester` 실행 → P0 고치기
5. AI·데이터 변경이면 `ai-eval` 결과를 PR 본문에 붙인다
6. 스쿼시 머지(`gh pr merge --squash --delete-branch`) → main 배포 Ready 확인(Vercel MCP) → 프로덕션에서 해당 기능 1회 확인
7. 이슈 자동 닫힘(`Closes #12`를 PR 본문에)

## 병렬 작업 (에이전트 팀·여러 세션)
- 이슈마다 **git worktree**로 폴더를 나눈다: `git worktree add ../jp-study-asst-15 feat/15-handwriting`. 서로 다른 파일 집합을 맡긴다 (같은 파일을 두 세션이 고치지 않게)
- 각 워크트리는 자기 PR을 만든다. 머지 순서는 사용자가 정한다

## 릴리스
- 단계가 끝날 때 `git tag v0.2.0` 식으로 태그 + GitHub Release 노트(`gh release create`), README 로드맵 갱신. 발표·포트폴리오용 스크린샷은 `docs/screenshots/`에 날짜 접두어로

## 안전장치
- 커밋 전 `git diff --staged`에 키·토큰처럼 보이는 문자열 금지. `.env*`는 추적하지 않는다(`.env.example`만)
- 되돌리기: 머지 전이면 `git revert <sha>`, 머지 후 문제면 Vercel에서 이전 배포로 Rollback(사용자 확인 후) + revert PR
- force push·`reset --hard`·`rm -rf` 금지(settings.json deny)
- CI 실패 시: 로그를 파일로 받아(`gh run view <id> --log-failed > /tmp/ci.log`) 필요한 부분만 읽는다

## 자동화 (키트 워크플로)
- `ci.yml`: lint · typecheck · vitest · build · Playwright
- `claude-review.yml`(선택): PR에 `claude-review` 라벨을 붙일 때만 Claude가 reviewer 체크리스트로 코멘트(최대 20턴). 큰 PR에 필요할 때만 받는 두 번째 의견이고, 리뷰 게이트는 로컬 `reviewer`. 다시 돌리려면 라벨을 뗐다 붙인다. 필수 검사가 아니다. `ANTHROPIC_API_KEY` 시크릿 필요. 학교 프록시 키라면 GitHub 서버에서 접근 가능한지 먼저 확인- `eval.yml`(선택): `src/lib/ai/**`·`evals/**` 변경 시 소규모 eval
- `data-refresh.yml`: 월 1회 사전 데이터 재빌드 → 변경 시 PR
