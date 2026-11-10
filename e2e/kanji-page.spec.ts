import { expect, expectNoHorizontalScroll, kanjiPath, test } from "./fixtures";

// 획순 데이터는 fixtures가 e2e/strokes/(職·あ)로 답하고, 그 밖의 글자는 404 (실제 CDN은 stroke-cdn.spec)
test.describe("한자 페이지", () => {
  test("인코딩된 주소로 열어도 획순과 AI 설명을 보여준다", async ({ page }) => {
    await page.goto("/kanji/%E8%81%B7");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("職");
    await expect(page.getByText("총 18획")).toBeVisible();
    for (const name of ["▶ 재생", "한 획씩", "따라 쓰기"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    const ai = page.getByRole("region", { name: "AI 설명" });
    await expect(ai.getByText("직업, 일")).toBeVisible();
    await expect(ai.getByText("AI가 만든 설명이라 틀릴 수 있어요.")).toBeVisible();
  });

  test("한 획씩을 누를 때마다 진행 수가 오른다", async ({ page }) => {
    await page.goto(kanjiPath("職"));
    const stepButton = page.getByRole("button", { name: "한 획씩", exact: true });

    await stepButton.click();
    await expect(page.getByText("한 획씩 1 / 18")).toBeVisible();
    await stepButton.click();
    await expect(page.getByText("한 획씩 2 / 18")).toBeVisible();
  });

  test("가나는 조각 획을 합친 획수로 보여주고 AI 설명은 없다", async ({ page }) => {
    await page.goto(kanjiPath("あ"));

    await expect(page.getByText("총 3획")).toBeVisible();
    await expect(page.getByRole("region", { name: "AI 설명" })).toHaveCount(0);
  });

  test("획순 데이터가 없는 글자(404)는 안내한다", async ({ page }) => {
    await page.goto(kanjiPath("薔"));

    await expect(page.getByText("이 글자는 획순 데이터가 없어요")).toBeVisible();
  });

  test("한자·가나가 아니면 찾을 수 없음 화면", async ({ page }) => {
    await page.goto("/kanji/abc");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("한자 페이지에 가로 스크롤이 없다", async ({ page }) => {
    await page.goto(kanjiPath("職"));
    await expect(page.getByText("총 18획")).toBeVisible();

    await expectNoHorizontalScroll(page);
  });
});
