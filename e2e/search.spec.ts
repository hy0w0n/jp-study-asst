import { expect, expectNoHorizontalScroll, kanjiPath, test } from "./fixtures";

test.describe("검색 (타이핑·붙여넣기)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("여러 글자는 칩으로 보여주고, 칩을 누르면 그 글자 페이지로 간다", async ({ page }) => {
    await page.getByRole("searchbox", { name: "한자 검색" }).fill("履歴書");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    await expect(page.getByRole("link", { name: /획순 보기$/ })).toHaveCount(3);
    await page.getByRole("link", { name: "履 획순 보기" }).click();

    await expect(page).toHaveURL(kanjiPath("履"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("履");
  });

  test("한 글자는 Enter로 바로 그 글자 페이지로 간다", async ({ page }) => {
    const box = page.getByRole("searchbox", { name: "한자 검색" });
    await box.fill("職");
    await box.press("Enter");

    await expect(page).toHaveURL(kanjiPath("職"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("職");
  });

  test("한자·가나가 없으면 안내 문구를 보여준다", async ({ page }) => {
    await page.getByRole("searchbox", { name: "한자 검색" }).fill("직업");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    await expect(page.getByText("한자나 가나를 입력해 주세요")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("예시 단어를 누르면 그 단어로 검색한다", async ({ page }) => {
    await page.getByRole("button", { name: "面接 (めんせつ) 검색하기" }).click();

    await expect(page.getByRole("searchbox", { name: "한자 검색" })).toHaveValue("面接");
    await expect(page.getByRole("link", { name: /획순 보기$/ })).toHaveCount(2);
  });

  test("홈에 가로 스크롤이 없다", async ({ page }) => {
    await expectNoHorizontalScroll(page);
  });
});
