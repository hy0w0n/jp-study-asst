import { test as base, expect, type Page } from "@playwright/test";

// E2E는 AI를 부르지 않는다. 모든 spec은 이 파일의 test를 쓰고, /api/kanji는 기본으로 아래 가짜 카드로 답한다.
// 형식은 서버(toUIMessageStreamResponse)와 같은 UI 메시지 스트림 SSE — node_modules/ai의 JsonToSseTransformStream·UI_MESSAGE_STREAM_HEADERS
export const MOCK_CARD = `**음독** ショク · **훈독** -
**뜻**: 직업, 일
**한국 한자와 차이**: 같음
**자주 쓰는 단어**:
- {職業|しょくぎょう} — 직업
- {就職|しゅうしょく} — 취직
**예문**: {職|しょく}を{探|さが}す。 → 일자리를 찾는다.`;

function uiMessageStream(text: string) {
  const parts = [
    { type: "start" },
    { type: "text-start", id: "mock" },
    { type: "text-delta", id: "mock", delta: text },
    { type: "text-end", id: "mock" },
    { type: "finish", finishReason: "stop" },
  ];
  return parts.map((p) => `data: ${JSON.stringify(p)}\n\n`).join("") + "data: [DONE]\n\n";
}

export async function mockKanjiApi(page: Page) {
  await page.route("**/api/kanji", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: uiMessageStream(MOCK_CARD),
    }),
  );
}

/** 서버가 오류로 답하는 경우 (500 AI 실패·미설정, 429 사용량 제한). 나중에 건 route가 먼저 처리된다. */
export async function failKanjiApi(page: Page, status: number) {
  await page.route("**/api/kanji", (route) =>
    route.fulfill({ status, json: { error: "테스트용 실패" } }),
  );
}

// 두 번째 인자는 Playwright 관례로 use지만, React의 use 훅 규칙에 걸려서 이름을 바꾼다
export const test = base.extend({
  page: async ({ page }, provide) => {
    await mockKanjiApi(page);
    await provide(page);
  },
});

export { expect };

export const kanjiPath = (char: string) => `/kanji/${encodeURIComponent(char)}`;

/** 375px에서 가로 스크롤이 생기지 않는다 (AGENTS 절대 규칙 1) */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
