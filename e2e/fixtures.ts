import { existsSync } from "node:fs";
import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import type { CardErrorKind } from "../src/lib/cards/schema";
import { SAMPLE_RESPONSE } from "../src/lib/cards/__fixtures__/kanji-card";

// 모든 spec은 이 파일의 test를 쓴다. 이 test는 외부 의존을 두 가지 막는다:
// 1) /api/kanji — AI를 부르지 않고 검증을 통과한 가짜 카드(SAMPLE_RESPONSE, 글자와 상관없이 職 카드)로 답한다
// 2) 획순 CDN — e2e/strokes/의 원본 JSON(職·あ)으로 답하고, 없는 글자는 404. 실제 CDN은 stroke-cdn.spec만 본다

export const mockKanjiApi = (page: Page) => page.route("**/api/kanji", (route) => route.fulfill({ json: SAMPLE_RESPONSE }));

function failWith(page: Page, status: number, kind: CardErrorKind) {
  return page.route("**/api/kanji", (route) => route.fulfill({ status, json: { error: "테스트용 실패", kind } }));
}

/**
 * /api/kanji가 실패하는 경우와 화면에 나와야 할 원인 문구 (route.ts는 JSON {error, kind}로 답한다).
 * 나중에 건 route가 먼저 처리되므로 기본 목을 덮어쓴다.
 */
export const KANJI_API_FAILURES: Record<string, { fail: (page: Page) => Promise<unknown>; reason: string }> = {
  "500 (AI 미설정)": { fail: (page) => failWith(page, 500, "config"), reason: "AI 서버가 응답하지 않았어요" },
  "502 (모델 오류)": { fail: (page) => failWith(page, 502, "ai"), reason: "AI 서버가 응답하지 않았어요" },
  "429 (사용량 제한)": { fail: (page) => failWith(page, 429, "rate-limit"), reason: "요청이 많아요" },
  "422 (검증 실패 — 미노출)": { fail: (page) => failWith(page, 422, "verify"), reason: "사전 확인을 통과하지 못해" },
  "JSON이 아닌 오류 (게이트웨이)": {
    fail: (page) => page.route("**/api/kanji", (route) => route.fulfill({ status: 504, body: "Gateway Timeout" })),
    reason: "AI 서버가 응답하지 않았어요",
  },
  "네트워크 끊김": {
    fail: (page) => page.route("**/api/kanji", (route) => route.abort("internetdisconnected")),
    reason: "인터넷 연결을 확인",
  },
};

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
