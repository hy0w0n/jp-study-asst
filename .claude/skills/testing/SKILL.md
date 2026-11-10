---
name: testing
description: 테스트 전략과 실행 — Vitest 단위 테스트(순수 함수·데이터·검증 로직), Playwright 모바일 E2E(핵심 동선·오류 대체 화면·로고 홈 이동), 접근성·시각 회귀, CI에서의 실행. "테스트 써줘", "E2E", "Playwright 테스트", "vitest", "회귀", "테스트 실패" 요청과 기능 구현 전후에 사용.
---

# Testing (완료의 증거)

해커톤 때 "완료"는 눈으로 한 번 본 것이었다. v2의 완료는 **테스트가 통과한 것**이다. 훅이 커밋 전에 `npm run check`(lint·typecheck·vitest)를 강제하고, CI가 PR마다 E2E까지 돌린다.

## 피라미드
| 층 | 도구 | 대상 | 속도 |
|---|---|---|---|
| 단위 | Vitest | `src/lib/**` 순수 함수: `furigana.ts`, `extractChars`, `loader.ts`의 `mergeSplitStrokes`(あ 4획→3획 고정 픽스처), `kanji/data.ts`(샘플 13자·역방향), `kanji/variants.ts`·`searchHits`(자형 정규화, 후보 여럿 분기는 `vi.mock`), `src/proxy.ts`(`NextRequest`로 직접 호출), `cards/verify.ts` | 초 |
| E2E | Playwright `@playwright/test` (iPhone 13 에뮬레이션) | 핵심 동선·오류 상태·네비게이션 | 분 |
| 평가 | `ai-eval` | AI 출력 품질 | 분·비용 |
| 사용성 | `ux-tester` 에이전트 (Playwright MCP, 미리보기 URL) | 사람 관점 | PR마다 |

## Vitest
- 설치: `npm i -D vitest` (React 컴포넌트는 당장 테스트하지 않는다 — 순수 로직 분리가 먼저). 설정 `vitest.config.mts`(`.ts`면 Vite가 ESM 경고)에 `test.include = ["src/**/*.test.ts"]`, `@/` alias. Vitest 5는 `@types/node` 22 이상이 필요하다
- 규칙: 테스트 파일은 대상 옆(`furigana.test.ts`). 픽스처는 `src/lib/kanji/__fixtures__/`(あ·ぬ 원본 JSON), `src/lib/ai/__fixtures__/kanji-card.ts`(완성 카드 — E2E 목도 이것을 쓴다)
- `loader.ts`는 모듈 캐시를 쓴다 → `loadCharData` 테스트는 테스트마다 다른 글자를 쓴다
- **버그를 고칠 때는 먼저 실패하는 테스트**를 쓴다 (`systematic-debugging`/TDD 스킬을 쓰면 더 좋다)
- 네트워크 호출(획순 CDN, kanjiapi.dev)은 `vi.stubGlobal("fetch", ...)`로 막는다

## Playwright E2E
- 설치: `npm i -D @playwright/test && npx playwright install chromium`
- `playwright.config.ts`: `projects: [{ name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } } }]` (iPhone 13 기본 브라우저는 webkit인데 CI는 chromium만 설치), `webServer: { command: "npm run build && npm run start -- -p 3200", url: "http://localhost:3200", reuseExistingServer: !process.env.CI }` (3000은 다른 앱, 3001은 dev 서버), `use.baseURL`
  - 주의: 로컬에서 3200에 예전 빌드가 떠 있으면 그 서버를 재사용해 **지금 코드가 아닌 빌드**를 검사한다. 결과가 이상하면 3200 프로세스를 끄고 다시 돌린다
- **외부 의존을 막는다**: 모든 spec은 `e2e/fixtures.ts`의 `test`를 쓴다. 이 `test`가 자동으로
  - `/api/kanji` → 서버와 같은 UI 메시지 스트림 형식의 가짜 카드(`SAMPLE_CARD`, 글자와 상관없이 職 카드). 실패는 `KANJI_API_FAILURES`(500·429·error 파트·본문 뒤 오류·빈 응답·네트워크 끊김)로 덮어쓴다(나중에 건 route가 먼저 처리)
  - 획순 CDN → `e2e/strokes/`의 원본 JSON(職·あ), 없는 글자는 404. 새 글자의 획순이 필요하면 CDN에서 받아 여기에 넣는다
  - 실제 CDN은 `stroke-cdn.spec.ts` 하나만 본다(`timeout: 15_000`, CI `retries: 1`)
- 테스트 (`e2e/*.spec.ts`), 모두 `data-testid`보다 역할·텍스트로 찾는다. **(예정)** 표시는 아직 기능이 없어 그 이슈에서 추가한다:
  1. `search.spec.ts` — `履歴書` 입력 → 칩 3개 → `履` 탭 → `/kanji/履` · 한 글자 `職` → 바로 이동 · 한글 `직업` → 안내 문구
  2. `kanji-page.spec.ts` — `/kanji/%E8%81%B7` 인코딩 주소, 획수·한 획씩, 가나 획 합치기, 데이터 없음(404), AI 섹션 내용 · **(예정, 0-4·0-5)** `/kanji/学` 사전 섹션(ガク·학·8획·출처 배지) 즉시 표시, `/kanji/學` → `/kanji/学` 리다이렉트 + 배너
  3. `fallback.spec.ts` — `KANJI_API_FAILURES` 각각: "AI 설명을 불러오지 못했어요." + [다시 시도], 획순은 그대로 · 다시 시도 성공 (심사 피드백: 오류 시 대체 메시지) · **(예정, 0-4)** 사전 섹션도 그대로
  4. `nav.spec.ts` — 하단 탭, 헤더 ‹ 버튼, 브라우저 뒤로 가기, 준비중 카드 → 모달 열고 닫기 · 공통 헤더 로고(한자·학습·404) 탭 → `/`, 44px · 홈에서 로고 탭 → 맨 위로 (#8)
  5. **(예정, 0-13)** `a11y.spec.ts` — `@axe-core/playwright`로 홈·한자 페이지 심각(critical/serious) 위반 0
  6. 가로 스크롤 없음: `document.documentElement.scrollWidth <= innerWidth`
- 시각 회귀(선택): `expect(page).toHaveScreenshot()` 홈·한자 페이지. 글꼴 로딩 때문에 `maxDiffPixelRatio` 0.02

## 명령 (package.json scripts — 설치 스크립트가 넣음)
- `npm run typecheck` = `tsc --noEmit` · `npm run test` = `vitest run` · `npm run test:e2e` = `playwright test` · `npm run check` = lint + typecheck + test
- 훅: 파일 수정 직후 ESLint, 턴 종료·작업 완료 시 typecheck, `git commit` 전 `check` (`.claude/hooks/`)

## CI (`.github/workflows/ci.yml`)
- PR·main push마다: `npm ci` → lint → typecheck → vitest → build → Playwright(chromium) → 실패 시 리포트 아티팩트
- CI에는 `ANTHROPIC_API_KEY`를 주지 않는다. E2E는 `e2e/fixtures.ts`가 `/api/kanji`를 전부 목으로 막으므로 키가 필요 없다

## 테스트를 안 쓰는 것
- 스타일·색 같은 취향, hanzi-writer 내부 동작, 외부 API의 응답 내용(목으로 대체)
