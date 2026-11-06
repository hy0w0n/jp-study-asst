---
name: planner
description: 기획·진행 관리(장기 프로젝트용). 로드맵의 단계를 GitHub 이슈로 쪼개고, 이슈마다 완료 조건(DoD)을 적고, 주간 점검에서 다음 할 일을 고르며, grill-me 결정을 문서에 고정할 때 사용. "기획", "로드맵", "이슈 만들어", "다음 뭐 할까", "주간 점검", "범위", "우선순위", "PRD 반영" 요청에 사용.
---

# Planner (장기 프로젝트 기획·진행)

해커톤 때는 docs/TASKS.md 한 장이었다. 이제는 **GitHub Issues가 작업 목록**, `docs/ROADMAP.md`가 단계 설명이다. 해커톤 문서(PRD·TASKS·PITCH)는 `docs/hackathon/`으로 옮겨 기록으로 남긴다.

## 분담
- `/grill-me`: 결정을 캐묻는다 (큰 기능·설계 변경 전). planner는 그 결정을 문서·이슈로 고정한다
- `superpowers`의 brainstorming/writing-plans(설치했다면): 한 이슈를 구현 계획으로 쪼갤 때. planner는 **무엇을·왜·언제**, writing-plans는 **어떻게**

## 이슈 규칙 (`gh issue create`)
- 제목: 동사로 시작, 한 가지 결과 (`한자 페이지 헤더에 로고 → 홈 링크 추가`)
- 본문 틀:
  ```
  ## 왜
  (사용자 불편 또는 심사 피드백 인용)
  ## 완료 조건 (DoD)
  - [ ] 동작: …
  - [ ] 테스트: vitest/E2E 어떤 파일
  - [ ] 정확도(해당 시): ai-eval 통과율 또는 데이터 검증
  - [ ] UX: ux-tester P0 없음
  - [ ] 문서: 스킬/README 갱신 여부
  ## 범위 밖
  ```
- 라벨: `bug` `feature` `accuracy` `ux` `infra` `data` + 단계 마일스톤(`phase-0-안정화`, `phase-1-tier2`, `phase-2-확장`)
- 크기: 한 이슈 = PR 하나 = 반나절 이내. 크면 쪼갠다

## 완료의 정의 (모든 이슈 공통)
1. `npm run check` 통과(훅이 강제) + 관련 E2E 통과(CI)
2. 사용자에게 보이는 변경이면 `ux-tester` 리포트 P0 = 0
3. AI·데이터 변경이면 `ai-eval` 숫자가 이전 이상
4. `reviewer` 에이전트 리뷰 반영
5. 스킬 문서·README가 코드와 어긋나지 않음 (해커톤 때 스킬은 OpenAI, 코드는 Anthropic으로 어긋났다)
"확인 못 함"은 솔직히 적는다. 추측으로 완료 처리하지 않는다.

## 주간 점검 (사용자가 "주간 점검" 또는 월요일 첫 세션)
1. `gh issue list --state open`, 지난주 머지된 PR, `docs/ACCURACY.md` 최신 숫자, Vercel 오류(Sentry 있으면) 요약
2. 로드맵 단계의 남은 이슈 vs 실제 속도 → 다음 주 이슈 3~5개 추천(이유 한 줄씩)
3. 새 아이디어는 `backlog` 라벨로만 만들고 단계에 넣지 않는다 (사용자 승인 후 이동)
4. 결과를 `docs/ROADMAP.md` 하단 "점검 기록"에 날짜와 함께 3줄

## 범위 규칙
- 늘리는 결정은 사용자에게 묻고, 줄이는 제안은 적극적으로
- 정확도·안정성 이슈(`accuracy`, `bug`)는 새 기능보다 앞선다 (교육 앱의 신뢰가 먼저)
- 결정은 문서(ROADMAP·이슈·ADR)에 남긴다. 대화에만 있는 결정은 없는 것

## 처음 한 번 (v2 전환)
- `docs/ROADMAP.md`를 읽고 Phase 0 이슈를 모두 만든다. 해커톤 TASKS의 L1·L3·L4와 Tier 2 S1~S4를 이슈로 옮기고 TASKS.md 상단에 "이슈로 이관됨" 메모
- 마일스톤 3개 생성(`gh api` 또는 웹)
