import type { Route } from "@playwright/test";
import { expect, KANJI_API_FAILURES, kanjiPath, mockKanjiApi, STROKE_DATA, test } from "./fixtures";

// 심사 피드백: AI가 실패해도 대체 메시지 + [다시 시도], 이미 있는 정보(획순)는 지우지 않는다 (AGENTS 절대 규칙 4)
test.describe("AI 설명 실패", () => {
  for (const [name, fail] of Object.entries(KANJI_API_FAILURES)) {
    test(`${name}: 오류 문구와 다시 시도를 보여주고 획순은 그대로 둔다`, async ({ page }) => {
      await fail(page);
      await page.goto(kanjiPath("職"));

      const ai = page.getByRole("region", { name: "AI 설명" });
      await expect(ai.getByRole("alert")).toContainText("AI 설명을 불러오지 못했어요.");
      await expect(ai.getByRole("button", { name: "다시 시도" })).toBeVisible();
      await expect(page.getByText("총 18획")).toBeVisible();
    });
  }

  test("다시 시도가 성공하면 설명이 나오고 오류 문구는 사라진다", async ({ page }) => {
    await KANJI_API_FAILURES["500 (AI 미설정)"](page);
    await page.goto(kanjiPath("職"));
    const ai = page.getByRole("region", { name: "AI 설명" });
    await expect(ai.getByRole("alert")).toBeVisible();

    await page.unroute("**/api/kanji");
    await mockKanjiApi(page);
    await ai.getByRole("button", { name: "다시 시도" }).click();

    await expect(ai.getByText("직업, 일")).toBeVisible();
    await expect(ai.getByRole("alert")).toHaveCount(0);
  });
});

// 이슈 #4: 획순 CDN이 네트워크 오류면 "데이터 없음"(404)과 구분하고, 다시 시도하면 새로 받는다
test.describe("획순 불러오기 실패", () => {
  test("네트워크 오류: 오류 문구와 다시 시도를 보여주고, 다시 시도가 성공하면 획순을 그린다", async ({ page }) => {
    const offline = (route: Route) => route.abort("internetdisconnected");
    await page.route(STROKE_DATA, offline);
    await page.goto(kanjiPath("職"));

    const stroke = page.getByRole("region", { name: "획순" });
    await expect(stroke.getByRole("alert")).toContainText("획순을 불러오지 못했어요");
    await expect(page.getByText("이 글자는 획순 데이터가 없어요")).toHaveCount(0);
    // 이미 있는 정보(AI 설명)는 그대로
    await expect(page.getByRole("region", { name: "AI 설명" }).getByText("직업, 일")).toBeVisible();

    await page.unroute(STROKE_DATA, offline); // fixtures의 로컬 획순 데이터로 돌아간다
    await stroke.getByRole("button", { name: "다시 시도" }).click();

    await expect(page.getByText("총 18획")).toBeVisible();
    await expect(stroke.getByRole("alert")).toHaveCount(0);
  });
});
