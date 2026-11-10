import { expect, KANJI_API_FAILURES, kanjiPath, mockKanjiApi, test } from "./fixtures";

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
