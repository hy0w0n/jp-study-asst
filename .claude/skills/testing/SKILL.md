---
name: testing
description: 테스트 전략과 실행 — Vitest 단위 테스트(순수 함수·데이터·검증 로직), Playwright 모바일 E2E(핵심 동선·오류 대체 화면·로고 홈 이동), 접근성·시각 회귀, CI에서의 실행. "테스트 써줘", "E2E", "Playwright 테스트", "vitest", "회귀", "테스트 실패" 요청과 기능 구현 전후에 사용.
---

# Testing (완료의 증거)

해커톤 때 "완료"는 눈으로 한 번 본 것이었다. v2의 완료는 **테스트가 통과한 것**이다. 훅이 커밋 전에 `npm run check`(lint·typecheck·vitest)를 강제하고, CI가 PR마다 E2E까지 돌린다.

## 피라미드
| 층 | 도구 | 대상 | 속도 |
|---|---|---|---|
| 단위 | Vitest | `src/lib/**` 순수 함수: `furigana.ts`, `extractChars`, `loader.ts`의 `mergeSplitStrokes`(あ 4획→3획 고정 픽스처), `kanji/data.ts`(샘플 13자·역방향), `cards/verify.ts` | 초 |
| E2E | Playwright `@playwright/test` (iPhone 13 에뮬레이션) | 핵심 동선·오류 상태·네비게이션 | 분 |
| 평가 | `ai-eval` | AI 출력 품질 | 분·비용 |
| 사용성 | `ux-tester` 에이전트 (Playwright MCP, 미리보기 URL) | 사람 관점 | PR마다 |

## Vitest
- 설치: `npm i -D vitest` (React 컴포넌트는 당장 테스트하지 않는다 — 순수 로직 분리가 먼저). 설정 `vitest.config.mts`(`.ts`면 Vite가 ESM 경고)에 `test.include = ["src/**/*.test.ts"]`, `@/` alias. Vitest 5는 `@types/node` 22 이상이 필요하다
- 규칙: 테스트 파일은 대상 옆(`furigana.test.ts`). 픽스처는 `src/lib/kanji/__fixtures__/`(あ·ぬ 원본 JSON 축약본)
- **버그를 고칠 때는 먼저 실패하는 테스트**를 쓴다 (`systematic-debugging`/TDD 스킬을 쓰면 더 좋다)
- 네트워크 호출(획순 CDN, kanjiapi.dev)은 `vi.stubGlobal("fetch", ...)`로 막는다

## Playwright E2E
- 설치: `npm i -D @playwright/test && npx playwright install chromium`
- `playwright.config.ts`: `projects: [{ name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } } }]` (iPhone 13 기본 브라우저는 webkit인데 CI는 chromium만 설치), `webServer: { command: "npm run build && npm run start -- -p 3200", url: "http://localhost:3200", reuseExistingServer: !process.env.CI }` (3000은 다른 앱, 3001은 dev 서버), `use.baseURL`
- **AI를 부르지 않는다**: 모든 spec은 `e2e/fixtures.ts`의 `test`를 쓴다. 이 `test`가 `/api/kanji`를 서버와 같은 UI 메시지 스트림 형식의 가짜 카드(`MOCK_CARD`)로 자동으로 막는다. 실패는 `failKanjiApi(page, 500)`처럼 덮어쓴다(나중에 건 route가 먼저 처리)
- 획순 데이터는 실제 CDN에서 받는다 → 획순을 기다리는 단언은 `timeout: 15_000`, CI는 `retries: 1`
- 테스트 (`e2e/*.spec.ts`), 모두 `data-testid`보다 역할·텍스트로 찾는다. **지금 있는 것**: search · kanji-page · fallback · nav (로고 → 홈은 `test.fixme`, 0-1에서 켠다). 사전 섹션·리다이렉트(0-4·0-5)와 a11y(0-13)는 그 이슈에서 추가:
  1. `search.spec.ts` — `履歴書` 입력 → 칩 3개 → `履` 탭 → `/kanji/履` · 한 글자 `職` → 바로 이동 · 한글 `직업` → 안내 문구
  2. `kanji-page.spec.ts` — `/kanji/学`: 사전 섹션(ガク·학·8획·출처 배지) 즉시 표시, AI 섹션은 로딩→내용, `/kanji/%E8%81%B7` 인코딩 주소, `/kanji/學` → `/kanji/学` 리다이렉트 + 배너
  3. `fallback.spec.ts` — `page.route("**/api/kanji", r => r.fulfill({ status: 500 }))`: 사전 섹션은 보이고 "설명을 준비하지 못했어요" + [다시 시도]가 보인다 (심사 피드백: 오류 시 대체 메시지)
  4. `nav.spec.ts` — 어느 화면에서든 로고 탭 → `/` (TASKS L4), 하단 탭, 뒤로 가기, 준비중 카드 → 모달 열고 닫기
  5. `a11y.spec.ts` — `@axe-core/playwright`로 홈·한자 페이지 심각(critical/serious) 위반 0
  6. 가로 스크롤 없음: `document.documentElement.scrollWidth <= innerWidth`
- 시각 회귀(선택): `expect(page).toHaveScreenshot()` 홈·한자 페이지. 글꼴 로딩 때문에 `maxDiffPixelRatio` 0.02

## 명령 (package.json scripts — 설치 스크립트가 넣음)
- `npm run typecheck` = `tsc --noEmit` · `npm run test` = `vitest run` · `npm run test:e2e` = `playwright test` · `npm run check` = lint + typecheck + test
- 훅: 파일 수정 직후 ESLint, 턴 종료·작업 완료 시 typecheck, `git commit` 전 `check` (`.claude/hooks/`)

## CI (`.github/workflows/ci.yml`)
- PR·main push마다: `npm ci` → lint → typecheck → vitest → build → Playwright(chromium) → 실패 시 리포트 아티팩트
- E2E가 AI를 부르지 않도록 `fallback.spec`처럼 라우트를 막거나, CI에서는 `ANTHROPIC_API_KEY` 없이 "AI 미설정" 경로를 테스트한다

## 테스트를 안 쓰는 것
- 스타일·색 같은 취향, hanzi-writer 내부 동작, 외부 API의 응답 내용(목으로 대체)
