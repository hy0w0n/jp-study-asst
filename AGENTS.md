<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:jp-hackathon-kit -->
# 프로젝트 규칙 — 일본어 학습 어시스턴트 (AI 해커톤)

> 이 파일에는 **항상 지켜야 할 규칙만** 둔다. 절차·노하우는 `.claude/skills/`와 `.claude/agents/`에 있다.
> 새 규칙을 추가하고 싶으면 먼저 "스킬로 옮길 수 있는가?"를 따진다. 이 파일은 80줄을 넘기지 않는다.

## 프로젝트
- 한 줄: 모르는 한자를 **찍고·쓰고·붙여넣으면** 일본식 획순과 AI 설명을 바로 보여주는 모바일 웹앱 (서비스명 가칭 KAKU — 확정 시 갱신)
- 대주제: 내 전공 현장을 바꾸는 AI · 마감: 오늘 점심(정확한 시각은 docs/TASKS.md) → 이후 발표
- 사용자: 일본 IT 기업 취업을 준비하는 한국인 대학생 (JLPT N3~N2), 주로 폰으로 짧게 공부
- 기획 문서: docs/PRD.md · 작업 목록: docs/TASKS.md · 발표 메모: docs/PITCH.md

## 범위 (기준은 docs/PRD.md 5장 — grill-me 후 planner가 갱신)
- **Tier 1** (위에서부터 완성, 배포 전엔 다른 것 금지)
  1. 한자 획순 — 획이 진하게 채워지는 방식 + 한 획씩 + 따라 쓰기 → `kanji-stroke`
  2. 한자 검색 — 직접 타이핑 + 사진 → `kanji-search`
  3. 한자 AI 설명 카드 (프롬프트 입력 없이 자동) → `jp-tutor-prompt`의 `kanji` 모드
  4. 확장 기능 자리 — `준비중` 배지 + 안내 시트 (최대 3개) → `designer`
- **Tier 2** (Tier 1 배포 후): 손글씨 검색, 내 한자장(Supabase). 시간이 없으면 준비중으로 전환.
- 준비중 기능은 화면만 만든다. 로직·API를 미리 만들지 않는다.

## 스택 (변경 금지)
Next.js(App Router) + TypeScript + Tailwind CSS · Supabase(Postgres, Anonymous Auth, RLS) · Vercel 배포 · Vercel AI SDK + OpenAI(`gpt-5.4-mini`) · hanzi-writer
- 라이브러리 API는 기억으로 쓰지 않는다. 설치된 버전의 문서/타입(node_modules) 또는 context7로 확인한다.

## 절대 규칙
1. **모바일 우선**: 기준 375×812. 터치 타깃 44px↑, 가로 스크롤 금지, `100dvh`, 하단 고정 요소는 safe-area 처리, 입력창 글자 16px↑.
2. **비밀값**은 `.env.local`에만. 코드·커밋·로그·채팅에 키를 쓰지 않는다. 새 변수는 `.env.example`에 이름만. `OPENAI_API_KEY`는 서버(Route Handler)에서만.
3. **Supabase**: 테이블을 만들면 같은 마이그레이션에서 RLS를 켜고 `auth.uid()` 정책을 만든다. 스키마 변경은 `supabase/migrations/*.sql`로 남긴다.
4. **완료의 정의**: `npm run build` 통과 + 모바일 뷰포트에서 실제 동작 확인. 확인 못 했으면 "확인 못 함"이라고 말한다. 추측으로 "완료" 금지.
5. **요청 범위만** 고친다. 관련 없는 리팩터링·포맷 변경 금지. 의존성 추가는 이유 한 줄과 함께.
6. **막히면** 같은 방법을 3번 넘게 반복하지 않는다. 원인 요약 + 더 단순한 대안 2개를 제시한다.
7. **기능 하나를 끝낼 때마다**: docs/TASKS.md 체크 → docs/PITCH.md 'AI 활용 로그'에 한 줄 → 커밋 → push (= Vercel 배포).
8. UI 문구는 한국어, 학습 내용은 일본어 + 읽기(후리가나). 

## 역할 분담 (스킬 / 에이전트)
| 상황 | 사용 |
|---|---|
| 기획의 빈틈 찾기 (질문 공세, 사용자가 직접 호출) | `/grill-me` → 합의 내용은 `planner`가 문서화 |
| 기획·범위 결정·작업 쪼개기·진행 점검 | `planner` 스킬 |
| 화면·컴포넌트·스타일 | `designer` 스킬 (+ frontend-design 플러그인, 충돌 시 designer 우선) |
| 브랜치·커밋·푸시·배포 확인·되돌리기 | `git-flow` 스킬 |
| 사용자 관점 점검 (코드 오류가 아닌 UX 문제) | `ux-tester` 서브에이전트 |
| 발표 요점 기록·발표자료 | `pitch-notes` 스킬 (+ pptx 스킬) |
| 한자 획순 구현 | `kanji-stroke` 스킬 |
| 한자 검색 (타이핑·사진·손글씨) | `kanji-search` 스킬 |
| 앱 내 AI 프롬프트·모드·출력 형식 | `jp-tutor-prompt` 스킬 |

## 명령어 · 폴더
- `npm run dev` · `npm run build` · `npm run lint`
- `src/app`(라우트) · `src/components` · `src/lib/{supabase,ai,kanji}` · `supabase/migrations` · `docs/`(PRD, TASKS, PITCH, UX_REVIEW, screenshots)
<!-- END:jp-hackathon-kit -->
