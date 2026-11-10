# ROADMAP — SENSE v2 (해커톤 이후)

> **현재 단계: Phase 0 안정화·정확도** (시작 2026-11-06)
> 작업 단위는 GitHub Issues. 이 문서는 단계의 목적과 순서만 적는다. `planner`가 관리.

## Phase 0 — 안정화·정확도 (심사 피드백 + 사용자 결정)
목적: 틀린 정보가 보이지 않게, 기본기가 되게, 이후 개발이 안전하게.
이슈: 마일스톤 `phase-0-안정화`. 권장 순서 #4 → 0-1 → 0-3 → (0-5 · 0-4 · 0-8) → 0-6 → 0-7 → 0-9, 0-10~0-12는 0-3 이후 아무 때나.
| # | 이슈 후보 | 스킬 | DoD 핵심 |
|---|---|---|---|
| — | 획순: 네트워크 실패를 '데이터 없음'으로 보여줌 (#4, bug) | kanji-stroke | 실패 구분 문구 + [다시 시도], 실패 비캐시 |
| 0-1 (#8) | 공통 헤더: 로고·워드마크 → 홈 링크, 모든 화면 (해커톤 L4) | designer | nav E2E 통과, 44px |
| 0-2 (#2 ✅) | 테스트 기반: Vitest + Playwright(모바일) + `npm run check` + CI | testing, git-flow | CI 녹색, fallback·nav spec |
| 0-3 (#9) | 사전 데이터 파이프라인 `data:build` (KANJIDIC2 + Unihan 18.0) + `kanji.json`·`variants.json` | kanji-data | 샘플 13자 테스트 통과 |
| 0-4 (#10) | 한자 페이지 사전 섹션 + 출처 배지 + 일본/한국 글꼴 비교 | kanji-data, designer | /kanji/学에 ガク·학·學 표시 |
| 0-5 (#11) | 구자체·한국 자형 정규화: 검색 칩·라우팅 리다이렉트·배너 (해커톤 L3①) | kanji-data, kanji-search | /kanji/學 → /kanji/学 |
| 0-6 (#13) | AI 카드 v2: 사전 사실 주입 + 구조화 출력 + 서버 검증 + 대체 화면 — **0-8 다음에** | jp-tutor-prompt, card-pipeline | 검증 실패 미노출, 사전 섹션 유지 |
| 0-7 (#14) | 카드 저장: Supabase `kanji_cards`(공용·읽기 전용) + 서빙 순서 | card-pipeline | 재방문 AI 호출 0회 |
| 0-8 (#12) | eval 스크립트 `eval:kanji` + `docs/ACCURACY.md` 첫 숫자 | ai-eval | 표본 30자 결과 기록 |
| 0-9 (#15) | 상용한자 2,136자 배치 생성 → 정적 카드 + 표본 감사 | card-pipeline, accuracy-auditor | 통과율 기록, 실패 목록 |
| 0-10 (#16) | 획순 데이터 전수 점검 + 예외 표 (해커톤 L1) | kanji-stroke | 불일치 0 또는 분류 완료 |
| 0-11 (#17) | 정보 화면(출처·라이선스·알아 두세요) + README 갱신 | designer | SOURCES.md 반영 |
| 0-12 (#18) | 오류 모니터링(Sentry 또는 Vercel 로그) + 속도 제한 | — | 실패 알림 1회 확인 |
| 0-13 (#19 → #20) | 디자인 시스템을 UI UX Pro Max로 이관: `--design-system -p "SENSE"` 비영속 실행 → 현재 토큰과 비교 → `/grill-me`로 채택 결정 → `--persist`로 `design-system/sense/MASTER.md` 생성 후 브랜드 결정 네 가지로 손질 → globals.css 동기화 → `pages/kanji.md` 오버라이드 → designer 스킬 토큰 절 갱신 | designer | MASTER.md = globals.css, a11y E2E 통과, 스크린샷 승인 |
| 0-14 (#21, backlog) | (참고·Phase 0 완료 조건 아님) `/design-taste-frontend`로 현재 화면 "AI 티" 감사 → `docs/design-audit.md`, 채택 항목만 이슈화 | designer | 감사 목록, 토큰 변경 없음 |
완료 조건: ux-tester 전체 점검 P0 = 0, accuracy-auditor P0 = 0, CI 녹색, 릴리스 `v0.2.0`.

## Phase 1 — Tier 2 (해커톤에서 못 한 기능)
| # | 이슈 후보 | 스킬 |
|---|---|---|
| 1-1 | 내 한자장: 등록·목록·연습(따라 쓰기 반복) — localStorage → Supabase 익명 로그인 동기화 | kanji-stroke, designer |
| 1-2 | 최근 검색 8개 | designer |
| 1-3 | 손글씨 검색(인라인 캔버스 → /api/vision → 후보 검증·정규화) | kanji-search |
| 1-4 | 사진 검색(축소 → /api/vision → 칩) + 예시 사진 | kanji-search |
| 1-5 | 홈 화면 추가(PWA 메타·아이콘·오프라인 획순 캐시) | designer |
완료 조건: 각 기능 E2E + ux-tester, 릴리스 `v0.3.0`.

## Phase 2 — 확장 (준비중 4개를 실제 기능으로, 하나씩)
| # | 이슈 후보 | 접근 |
|---|---|---|
| 2-1 | 독해: 일본어 텍스트 붙여넣기 → 형태소 분석(kuromoji.js 등, `research`로 선정)으로 후리가나 → 모르는 한자 탭 → 한자 페이지 → AI 요약·해설 | 결정적 도구 먼저, AI는 해설만 |
| 2-2 | 문법: 문형 검색·예문(JMdict/Tatoeba) + AI 설명, 카드 파이프라인 재사용 | card-pipeline 일반화 |
| 2-3 | 청해: TTS(Web Speech `ja-JP`)로 예문 듣기·받아쓰기 | 브라우저 API |
| 2-4 | 회화: 면접 답변 다듬기(사용자 입력 기반, 지어내기 금지) | jp-tutor-prompt |
| 2-5 | 학습 기록 → 약점 한자 추천 | 데이터 |

## Phase 3 — 포트폴리오·성장
- 3-1 SENSE 소개 랜딩 페이지(한국어·일본어, `/about` 또는 별도 경로): `/ui-ux-pro-max --domain landing` + `pages/landing.md` 오버라이드로 설계, 넘기기 전 `/design-taste-frontend` 사전 점검(참고). MASTER.md 토큰 유지, 수치는 ACCURACY.md의 실측만
- 일본어 README·技術記事(Zenn/Qiita)로 일본 취업 포트폴리오화, 데모 영상, 성능·비용 수치
- `docs/LEARNING.md`의 개념을 실제로 쓴 사례로 채우기

## 점검 기록
- 2026-11-06: v2 키트 적용 시작. Phase 0 이슈 생성 예정
- 2026-11-10 (주간 점검): 머지 3건(#1 키트 v2, #3 테스트 기반 0-2, #6 리뷰 워크플로). Phase 0 이슈 #7~#21 생성 + 라벨·마일스톤, 해커톤 문서 → `docs/hackathon/`. ACCURACY 숫자 없음, `data:build`·`eval:kanji`·`cards:generate`·`data:audit-strokes` 스크립트 파일 아직 없음
- 순서 조정: 0-8(eval 기준선)을 0-6(AI 카드 v2)보다 먼저 — v1 숫자가 있어야 "이전 이상"을 판단. 0-13은 반나절 크기로 두 이슈(#19 결정 → #20 적용)로 쪼갬. 0-14는 참고용이라 `backlog`(승인 시 이동)
- 다음 주: #4 획순 오류 구분 → #8 공통 헤더 → #9 `data:build` → #11 구자체 정규화
