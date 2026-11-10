import { expect, kanjiPath, test } from "./fixtures";

test.describe("이동", () => {
  test("하단 탭으로 한자 ↔ 학습을 오가고 현재 탭이 표시된다", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(tabs.getByRole("link", { name: "한자" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "학습" }).click();
    await expect(page).toHaveURL("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("학습");
    await expect(tabs.getByRole("link", { name: "학습" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "한자" }).click();
    await expect(page).toHaveURL("/");
  });

  test("한자 페이지에서는 한자 탭이 현재 탭이고, 뒤로 가기는 검색으로 간다", async ({ page }) => {
    await page.goto(kanjiPath("職"));
    const tabs = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(tabs.getByRole("link", { name: "한자" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "검색으로 돌아가기" }).click();
    await expect(page).toHaveURL("/");
  });

  test("준비중 학습 카드는 안내 시트를 열고 [확인]·ESC로 닫는다", async ({ page }) => {
    await page.goto("/learn");
    const sheet = page.getByRole("dialog", { name: "서비스 준비중입니다" });

    await page.getByRole("button", { name: /문법/ }).click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "확인" }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: /회화/ }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("외울 한자로 등록은 준비중 시트를 연다", async ({ page }) => {
    await page.goto(kanjiPath("職"));
    await page.getByRole("button", { name: /외울 한자로 등록/ }).click();

    const sheet = page.getByRole("dialog", { name: "서비스 준비중입니다" });
    await expect(sheet).toContainText("내 한자장");
    await sheet.getByRole("button", { name: "확인" }).click();
    await expect(sheet).toBeHidden();
  });

  // ROADMAP 0-1에서 구현하면 fixme를 지운다: 지금은 한자 페이지에 로고가 없다
  test.fixme("어느 화면에서든 로고를 누르면 홈으로 간다", async ({ page }) => {
    for (const path of [kanjiPath("職"), "/learn"]) {
      await page.goto(path);
      await page.getByRole("link", { name: /SENSE/ }).click();
      await expect(page).toHaveURL("/");
    }
  });
});
