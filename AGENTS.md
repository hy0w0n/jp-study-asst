<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:jp-hackathon-kit -->
# 프로젝트 규칙 — SENSE (センセ) · 일본 한자 학습 앱 (v2, 해커톤 이후)

> 항상 지켜야 할 규칙만 둔다. 절차·노하우는 `.claude/skills/`, 역할은 `.claude/agents/`. 80줄을 넘기지 않는다.

## 프로젝트
- 한 줄: 모르는 한자를 입력(타이핑·손글씨·사진)하면 **일본식 획순**과 **사전 데이터로 검증된 설명**을 보여주는 모바일 웹앱. 배포 https://jp-study-asst.vercel.app
- 사용자: 일본 IT 취업을 준비하는 한국인 학습자(JLPT N3~N2). 한국식 자형(學·國)으로 쓰는 버릇이 있다
- 문서: `docs/ROADMAP.md`(단계·현재 상태) · `docs/ACCURACY.md`(정확도 정책·숫자) · `docs/LEARNING.md`(왜 이렇게 만드는가) · 해커톤 기록은 `docs/hackathon/`
- 작업 목록: **GitHub Issues** (이슈 = 브랜치 = PR)

## 정확도 원칙 (교육 앱의 1순위 — 심사 피드백 반영)
1. **정답이 있는 정보(읽기·획수·급수·한국 음·자형 차이)는 사전 데이터**(KANJIDIC2·JMdict·Unihan)로만 보여준다. AI가 말하지 않는다 → `kanji-data`
2. AI는 뜻 번역·단어 선택·예문만 맡고, **사전 사실을 입력으로 받아** 생성하며, 결과는 저장 전에 검증한다 → `jp-tutor-prompt`, `card-pipeline`
3. 검증을 통과한 카드만 저장·노출하고, 같은 한자는 모든 사용자에게 같은 카드를 보여준다. 상용한자는 미리 생성해 런타임 AI 의존을 없앤다
4. 모든 정보에 **출처·상태 배지**를 붙인다. AI 생성물은 반드시 "AI 생성" 표시
5. 프롬프트·모델·데이터를 바꿀 때는 `ai-eval` 숫자로 판단한다. 느낌으로 바꾸지 않는다

## 스택 (변경 시 스킬 문서도 같은 PR에서 고친다)
Next.js 16(App Router) + TypeScript + Tailwind 4 · AI SDK 7 + `@ai-sdk/anthropic` (키·`ANTHROPIC_BASE_URL`은 서버만, 기본 `claude-haiku-5-5` thinking off) · hanzi-writer + `@k1low/hanzi-writer-data-jp` · Supabase(카드 캐시·내 한자장, RLS) · Vercel · Vitest + Playwright
- 라이브러리 API는 기억으로 쓰지 않는다. 설치본 타입·문서(node_modules) 또는 context7로 확인한다. Next 16은 `node_modules/next/dist/docs` 먼저

## 절대 규칙
1. **모바일 우선**: 375×812 기준, 터치 44px↑, 입력 16px↑, 가로 스크롤 금지, `100dvh`, safe-area
2. **비밀값**은 `.env.local`에만. 코드·커밋·로그·채팅에 키를 쓰지 않는다. 새 변수는 `.env.example`에 이름만. Supabase service role 키는 서버만
3. **완료의 정의**: `npm run check` 통과(훅이 강제) + 관련 테스트 + 모바일 뷰포트 실제 확인. 사용자 화면 변경은 `ux-tester` P0 = 0, AI·데이터 변경은 `ai-eval` 이전 이상. 확인 못 했으면 "확인 못 함"이라고 말한다
4. **오류 처리 기본값**: 네트워크·AI·데이터 실패를 구분한 문구 + [다시 시도]. 실패해도 이미 있는 정보(사전·획순)는 지우지 않는다
5. **요청 범위만** 고친다. 의존성 추가는 이유 한 줄과 함께. 같은 방법을 3번 넘게 반복하지 않고 원인 요약 + 대안 2개
6. **main에 직접 푸시 금지**. 이슈 브랜치 → PR → CI·리뷰 게이트 → 스쿼시 머지 → `git-flow`
7. **기능 하나 끝날 때마다**: 이슈의 DoD 체크 → PR 본문에 확인 방법 → 문서(스킬·README·ACCURACY) 일치 확인
8. UI 문구는 한국어, 학습 내용은 일본어 + 읽기. 사전 데이터 출처 문구는 `src/data/SOURCES.md` 그대로

## 역할 분담
| 상황 | 사용 |
|---|---|
| 큰 결정·설계 변경 전 질문 공세 | `/grill-me` → 결정은 `planner`가 이슈·문서로 고정 |
| 로드맵·이슈·주간 점검 | `planner` |
| 한 이슈의 구현 계획·TDD·검증 | superpowers(brainstorming → writing-plans → test-driven-development → verification-before-completion) |
| 화면·컴포넌트 디자인 (토큰·패턴·스택 권고) | **`/ui-ux-pro-max`** 메인 — 토큰은 `design-system/sense/MASTER.md`, 순서·프로젝트 규칙(헤더·배지·상태·모바일·접근성)은 `designer` 스킬 |
| 넘기기 전 "AI 티" 감사 / 컴포넌트 다듬기 | `/design-taste-frontend` · frontend-design — **참고용, 사용자가 부를 때만**. 토큰 변경 금지 |
| 사전 데이터·자형 정규화 | `kanji-data` |
| AI 프롬프트·스키마 | `jp-tutor-prompt` |
| 카드 생성·검증·저장·서빙 | `card-pipeline` |
| 평가·회귀 | `ai-eval` |
| 테스트 작성·실행 | `testing` |
| 획순·한자 페이지·데이터 점검 | `kanji-stroke` |
| 입력 3종 | `kanji-search` |
| Git·PR·CI·배포 | `git-flow` |
| 코드 리뷰 (고치지 않음) | `reviewer` 에이전트 |
| 사용자 관점 점검 | `ux-tester` 에이전트 |
| 정확도 감사 | `accuracy-auditor` 에이전트 |
| 조사가 필요할 때 | `research` 스킬(1차 출처만) |

## 명령어 · 폴더
- `npm run dev` · `build` · `lint` · `typecheck` · `test`(vitest) · `test:e2e`(playwright) · `check`(lint+typecheck+test) · `data:build` · `eval:kanji` · `cards:generate`
- `src/app` · `src/components` · `src/lib/{ai,kanji,cards}` · `src/data`(빌드 산출, 커밋) · `data-src/`(원본, gitignore) · `scripts/` · `e2e/` · `evals/` · `supabase/migrations` · `docs/`
<!-- END:jp-hackathon-kit -->
