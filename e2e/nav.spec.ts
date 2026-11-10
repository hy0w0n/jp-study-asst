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

  test("한자 페이지에서는 한자 탭이 현재 탭이고, 헤더의 ‹ 버튼은 검색으로 간다", async ({ page }) => {
    await page.goto(kanjiPath("職"));
    const tabs = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(tabs.getByRole("link", { name: "한자" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "검색으로 돌아가기" }).click();
    await expect(page).toHaveURL("/");
  });

  test("검색 → 한자 페이지에서 브라우저 뒤로 가기를 하면 검색 화면으로 돌아온다", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "한자 검색" });
    await box.fill("職");
    await box.press("Enter");
    await expect(page).toHaveURL(kanjiPath("職"));

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("searchbox", { name: "한자 검색" })).toBeVisible();
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

  // 이슈 #8 (ROADMAP 0-1): 모든 화면 헤더의 로고+SENSE가 하나의 홈 링크, 터치 영역 44px 이상
  test("어느 화면에서든 로고를 누르면 홈으로 간다", async ({ page }) => {
    for (const [name, path] of [["한자", kanjiPath("職")], ["학습", "/learn"], ["404", "/does-not-exist"]]) {
      await test.step(name, async () => {
        await page.goto(path);
        await expect(page.getByRole("banner")).toHaveCount(1);
        const logo = page.getByRole("link", { name: "SENSE 홈으로" });
        const box = await logo.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
        await logo.click();
        await expect(page).toHaveURL("/");
      });
    }
  });

  test("홈에서 로고를 누르면 맨 위로 간다", async ({ page }) => {
    await page.goto("/");
    // 홈은 짧아서 스크롤이 생기도록 늘린다. 헤더가 화면 밖이어도 누를 수 있게 dispatchEvent로 클릭
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 500);
    });
    await page.getByRole("link", { name: "SENSE 홈으로" }).dispatchEvent("click");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveURL("/");
  });
});
