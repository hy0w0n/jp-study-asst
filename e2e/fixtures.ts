import { existsSync } from "node:fs";
import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import { SAMPLE_CARD } from "../src/lib/ai/__fixtures__/kanji-card";

// 모든 spec은 이 파일의 test를 쓴다. 이 test는 외부 의존을 두 가지 막는다:
// 1) /api/kanji — AI를 부르지 않고 가짜 카드(SAMPLE_CARD, 글자와 상관없이 職 카드)로 답한다
// 2) 획순 CDN — e2e/strokes/의 원본 JSON(職·あ)으로 답하고, 없는 글자는 404. 실제 CDN은 stroke-cdn.spec만 본다

// 서버(toUIMessageStreamResponse)와 같은 UI 메시지 스트림 SSE — node_modules/ai의 JsonToSseTransformStream·UI_MESSAGE_STREAM_HEADERS
type Chunk = Record<string, unknown>;
const FINISH: Chunk = { type: "finish", finishReason: "stop" };
const textChunks = (text: string): Chunk[] => [
  { type: "text-start", id: "mock" },
  { type: "text-delta", id: "mock", delta: text },
  { type: "text-end", id: "mock" },
];

async function streamKanjiApi(page: Page, chunks: Chunk[]) {
  const body = [{ type: "start" }, ...chunks].map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  await page.route("**/api/kanji", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body,
    }),
  );
}

export const mockKanjiApi = (page: Page) => streamKanjiApi(page, [...textChunks(SAMPLE_CARD), FINISH]);

/**
 * /api/kanji가 실패하는 경우들. 나중에 건 route가 먼저 처리되므로 기본 목을 덮어쓴다.
 * - 500: 키 미설정 / 429: 사용량 제한 (route.ts가 JSON으로 답함)
 * - 모델 오류: 서버는 200으로 스트림을 연 뒤 error 파트를 보낸다 (route.ts의 onError)
 */
export const KANJI_API_FAILURES: Record<string, (page: Page) => Promise<unknown>> = {
  "500 (AI 미설정)": (page) => failWithStatus(page, 500),
  "429 (사용량 제한)": (page) => failWithStatus(page, 429),
  "모델 오류 (error 파트)": (page) => streamKanjiApi(page, [{ type: "error", errorText: "AI 설명을 불러오지 못했어요." }]),
  "본문 일부 뒤 모델 오류": (page) =>
    streamKanjiApi(page, [
      { type: "text-start", id: "mock" },
      { type: "text-delta", id: "mock", delta: SAMPLE_CARD.slice(0, 30) },
      { type: "error", errorText: "AI 설명을 불러오지 못했어요." },
    ]),
  "빈 응답": (page) => streamKanjiApi(page, [FINISH]),
  "네트워크 끊김": (page) => page.route("**/api/kanji", (route) => route.abort("internetdisconnected")),
};

function failWithStatus(page: Page, status: number) {
  return page.route("**/api/kanji", (route) => route.fulfill({ status, json: { error: "테스트용 실패" } }));
}

export const STROKE_DATA = /\/@k1low\/hanzi-writer-data-jp@0\.8\.0\/[^/]+\.json$/;
const STROKES_DIR = path.join(__dirname, "strokes");

async function serveStrokes(page: Page) {
  await page.route(STROKE_DATA, (route) => {
    const file = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "");
    const local = path.join(STROKES_DIR, file);
    // 다른 출처(CDN)로 가는 fetch라 CORS 헤더가 있어야 페이지가 응답을 읽는다
    const headers = { "access-control-allow-origin": "*" };
    return existsSync(local)
      ? route.fulfill({ path: local, contentType: "application/json", headers })
      : route.fulfill({ status: 404, body: "Not Found", headers });
  });
}

// 두 번째 인자는 Playwright 관례로 use지만, React의 use 훅 규칙에 걸려서 이름을 바꾼다
export const test = base.extend({
  page: async ({ page }, provide) => {
    await mockKanjiApi(page);
    await serveStrokes(page);
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
