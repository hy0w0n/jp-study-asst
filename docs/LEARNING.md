# LEARNING — 이 프로젝트에서 쓰는 AI 개발 방식 (왜 이렇게 만드는가)

> 해커톤 때는 "프롬프트 → 코드"가 전부였다. v2는 아래 단계를 하나씩 몸에 익히는 것이 목표다. 각 항목: 한 줄 정의 → 이 프로젝트의 어디 → 왜 → 더 보기.

## 단계 지도 (지금 어디인가)
| 단계 | 이름 | 해커톤 | v2 |
|---|---|---|---|
| L1 | 프롬프트로 코드 생성 | ✓ | |
| L2 | 규칙·스킬로 행동 고정 (AGENTS.md, skills) | ✓ | 스킬 10개로 확장 |
| L3 | 훅·게이트로 품질 강제 | ✗ | lint·typecheck·check 훅, PR 템플릿, 브랜치 보호 |
| L4 | 서브에이전트·에이전트 팀으로 역할 분리 | 정의만 하고 안 씀 | reviewer·ux-tester·accuracy-auditor를 DoD에 넣어 **구조로 강제** |
| L5 | CI·스케줄에서 에이전트 실행 | ✗ | GitHub Actions: CI, Claude 리뷰, eval, 데이터 갱신 |
| L6 | 평가(evals)·관측으로 AI 품질을 숫자로 관리 | 수동 측정 | ai-eval, ACCURACY.md, Sentry |
| L7 | 근거 기반 생성·캐시로 AI 의존 축소 | ✗ | 사전 데이터 + 검증 + 카드 저장 |

## 개념
### 1. 근거 기반 생성 (grounded generation, RAG의 작은 형태)
- 정의: 모델에게 "기억"이 아니라 **검증된 사실을 입력으로 주고** 그 안에서만 답하게 한다
- 어디: `jp-tutor-prompt`의 [사전 사실]·[단어 후보] 블록, `kanji-data`
- 왜: 해커톤의 훈독 오류(職→しごと)·자형 오판은 모델 지식의 한계. 사실을 주면 "생성"이 "선택·번역"으로 바뀌어 오류가 구조적으로 줄어든다
- 더 보기: Anthropic 문서의 "Reduce hallucinations", AI SDK `generateObject`

### 2. 구조화 출력 + 스키마 검증
- 정의: 자유 텍스트 대신 JSON 스키마(zod)로 받고, 코드로 검증한다
- 어디: `KanjiCardAi` 스키마, `cards/verify.ts`
- 왜: 형식 통과율 83%의 근본 원인은 "텍스트를 정규식으로 파싱"이었다. 스키마는 형식 문제를 없애고 검증을 코드로 만든다

### 3. 평가를 테스트처럼 (evals)
- 정의: AI 출력을 정답 셋·판정 모델로 채점해 **숫자**로 남기고, 바꿀 때마다 비교한다
- 어디: `ai-eval`, `evals/`, `docs/ACCURACY.md`, `eval.yml`
- 왜: 한 번 통과는 운(4/9). 숫자가 없으면 프롬프트 변경이 개선인지 퇴보인지 모른다
- 더 보기: promptfoo 문서, "LLM-as-judge" 개념

### 4. 검증된 결과의 캐시·사전 생성
- 정의: 검증을 통과한 출력을 저장해 재사용하고, 가능한 범위는 미리 만들어 둔다
- 어디: `card-pipeline`(정적 카드 + Supabase)
- 왜: 사용자 수와 토큰이 비례하지 않게, 모두에게 같은(검수된) 결과, 응답 0초. "AI 의존도 완전히 줄이기"는 결국 이것이다

### 5. 훅 (hooks) = 규칙을 "권고"에서 "강제"로
- 정의: Claude Code의 생명주기(파일 수정 후, 턴 종료, 도구 실행 전)에 스크립트를 걸어 통과 못 하면 막는다(exit 2)
- 어디: `.claude/hooks/`, `settings.json`의 PostToolUse·Stop·PreToolUse·TaskCompleted
- 왜: 해커톤에서 "UX 테스트는 나중에"가 되어 결국 안 했다. AGENTS.md에 적어도 안 지켜지는 것은 훅으로 만든다
- 더 보기: code.claude.com/docs/en/hooks (`stop_hook_active`, exit code 의미)

### 6. 서브에이전트 vs 에이전트 팀
- 서브에이전트: 결과만 돌려받는 일꾼(리뷰·점검·조사). 컨텍스트가 분리되어 "구현한 사람의 편견" 없이 본다 → reviewer·ux-tester·accuracy-auditor
- 에이전트 팀(실험 기능): 독립 세션들이 작업 목록·메시지로 협업. 토큰이 많이 든다. 쓸 곳: 경쟁 가설 디버깅, 다관점 리뷰, 파일이 겹치지 않는 병렬 구현(워크트리)
- 왜: 역할을 "문서로 정의"만 하면 안 쓴다. DoD와 PR 템플릿이 에이전트 실행을 요구해야 쓴다

### 7. CI 안의 에이전트
- 정의: GitHub Actions에서 테스트·빌드뿐 아니라 Claude 리뷰·eval·데이터 갱신을 자동 실행
- 어디: `.github/workflows/*`
- 왜: 사람이 잊어도 돌아간다. PR이 품질의 단위가 된다

### 8. 스펙 → 계획 → TDD → 검증 (superpowers / Matt Pocock)
- 정의: 코드 전에 설계와 계획, 구현은 실패하는 테스트부터, 끝낼 때는 증거(명령 출력)로
- 어디: `/grill-me`(결정), brainstorming·writing-plans(계획), test-driven-development, verification-before-completion
- 왜: "완료"라는 말이 믿을 수 있어진다

### 9. 관측 (observability)
- 정의: 실패·지연·비용을 기록하고 보이게 한다 (Sentry, Vercel 로그, 서버 로그의 토큰 수)
- 왜: 사용자가 겪는 오류를 내가 먼저 안다. eval 표본은 실제 실패에서 늘어난다

### 10. 워크트리로 병렬 작업
- 정의: 브랜치마다 별도 폴더(`git worktree`)로 세션을 나눠 동시에 작업
- 왜: 두 세션이 같은 파일을 고치면 서로 덮어쓴다. 파일 집합을 나누는 것이 병렬화의 전제

### 11. 자율 루프 (ralph-wiggum)
- 정의: 완료 조건(테스트 통과, 불일치 0)을 만족할 때까지 Stop 훅이 같은 프롬프트를 다시 넣는다
- 어디: 획순 전수 점검(0-10), 배치 카드 실패 재처리
- 주의: 반드시 `--max-iterations`, 완료 조건이 **기계적으로 판정 가능**할 때만

### 12. 메모리와 인수인계
- Claude Code 자동 메모리(MEMORY.md, 프로젝트별)는 수정 사항·선호를 스스로 남긴다. 긴 작업 전환은 `/handoff`. 결정은 이슈·ROADMAP·ADR에

## 루틴
- 이슈 시작: `/grill-me`(크면) → 계획 → TDD → PR → reviewer → (화면이면) ux-tester → 머지
- 주 1회: `planner` 주간 점검, `accuracy-auditor`(AI·데이터 변경 주)
- 월 1회: 데이터 갱신 PR 확인, 전체 ux-tester, LEARNING.md에 "이번 달 배운 것" 3줄

## 더 읽을 것
- Claude Code 문서: hooks · sub-agents · agent-teams · skills · github-actions
- AI SDK 문서: structured output(generateObject/streamObject), providers(anthropic)
- Anthropic: Building effective agents · prompt engineering overview
- promptfoo 문서(evals) · Playwright 문서(mobile emulation) · EDRDG(KANJIDIC/JMdict 라이선스)
