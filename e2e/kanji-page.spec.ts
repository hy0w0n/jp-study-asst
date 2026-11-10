import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalScroll, KANJI_API_FAILURES, kanjiPath, test } from "./fixtures";

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
    await expect(page.getByRole("region", { name: "사전", exact: true })).toHaveCount(0);
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

// 사전 섹션은 src/data/kanji.json(KANJIDIC2 + Unihan)을 서버에서 그린다 — 목이 필요 없다
test.describe("사전 섹션", () => {
  const dictionary = (page: Page) => page.getByRole("region", { name: "사전", exact: true });
  const korean = (page: Page) => page.getByRole("region", { name: "한국 한자", exact: true });

  test("学: 읽기·획수·학년·한국 자형·한국 음을 출처 배지와 함께 보여준다", async ({ page }) => {
    await page.goto(kanjiPath("学"));

    const dict = dictionary(page);
    await expect(dict.getByText("사전 · KANJIDIC2")).toBeVisible();
    await expect(dict.getByText("ガク")).toBeVisible();
    await expect(dict.getByText("まな(ぶ)")).toBeVisible();
    await expect(dict.getByText("8획")).toBeVisible();
    await expect(dict.getByText("초등학교 1학년")).toBeVisible();

    const ko = korean(page);
    await expect(ko.getByText("Unihan", { exact: true })).toBeVisible();
    await expect(ko.locator('[lang="ja"]', { hasText: "学" })).toBeVisible();
    await expect(ko.locator('[lang="ko"]', { hasText: "學" })).toBeVisible();
    await expect(ko.getByText("학", { exact: true })).toBeVisible();
    await expect(ko.getByText("자형이 달라요", { exact: false })).toBeVisible();
  });

  test("直: 같은 글자는 일본·한국 글꼴로 나란히 보여준다", async ({ page }) => {
    await page.goto(kanjiPath("直"));

    const ko = korean(page);
    await expect(ko.locator('[lang="ja"]', { hasText: "直" })).toHaveCSS("font-family", /^["']?Noto Sans JP/);
    await expect(ko.locator('[lang="ko"]', { hasText: "直" })).toHaveCSS("font-family", /^["']?Noto Sans KR/);
    await expect(ko.getByText("일본 글꼴")).toBeVisible();
    await expect(ko.getByText("한국 글꼴")).toBeVisible();
    await expect(ko.getByText("같은 글자예요", { exact: false })).toBeVisible();
  });

  test("AI 설명이 실패해도 사전 섹션은 그대로 남는다", async ({ page }) => {
    await KANJI_API_FAILURES["500 (AI 미설정)"](page);
    await page.goto(kanjiPath("職"));

    await expect(page.getByRole("region", { name: "AI 설명" }).getByRole("alert")).toBeVisible();
    await expect(dictionary(page).getByText("ショク · ソク")).toBeVisible();
    await expect(korean(page).getByText("직", { exact: true })).toBeVisible();
  });

  test("한국 자형이 없는 국자(込)는 이유와 KANJIDIC2 한국 음을 보여준다", async ({ page }) => {
    await page.goto(kanjiPath("込"));

    const ko = korean(page);
    await expect(ko.getByText("일본에서 만든 글자(国字)", { exact: false })).toBeVisible();
    await expect(ko.getByText("(KANJIDIC2)")).toBeVisible();
    await expect(ko.locator('[lang="ko"]')).toHaveCount(0);
  });

  test("상용한자가 아니면(薔) 사전 섹션 대신 안내한다", async ({ page }) => {
    await page.goto(kanjiPath("薔"));

    await expect(page.getByText("상용한자가 아니라서 사전 정보", { exact: false })).toBeVisible();
    await expect(dictionary(page)).toHaveCount(0);
  });
});
