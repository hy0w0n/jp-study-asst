import { expect, kanjiPath, test } from "./fixtures";

// 한국 자형·구자체 → 일본 신자체 (variants.json). 획순 데이터는 fixtures가 職·あ만 주므로 여기서는 404 안내가 떠도 된다
const convertedPath = (char: string, from: string) => `${kanjiPath(char)}?from=${encodeURIComponent(from)}`;

test.describe("한국 자형·구자체 정규화", () => {
  test("한국 자형 한 글자(學)를 검색하면 일본 学 페이지로 가서 배너를 보여준다", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "한자 검색" });
    await box.fill("學");
    await box.press("Enter");

    await expect(page).toHaveURL(convertedPath("学", "學"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("学");
    await expect(page.getByRole("note")).toContainText("한국 學 → 일본 学");
  });

  test("여러 글자(學國樂)는 신자체 칩으로 바꾸고 원래 글자를 작게 보여준다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "한자 검색" }).fill("學國樂");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    for (const [from, to] of [
      ["學", "学"],
      ["國", "国"],
      ["樂", "楽"],
    ]) {
      const chip = page.getByRole("link", { name: `${from}의 일본 자형 ${to} 획순 보기` });
      await expect(chip).toBeVisible();
      await expect(chip).toContainText(`${from}→${to}`);
    }

    await page.getByRole("link", { name: "國의 일본 자형 国 획순 보기" }).click();
    await expect(page).toHaveURL(convertedPath("国", "國"));
    await expect(page.getByRole("note")).toContainText("한국 國 → 일본 国");
  });

  test("주소로 /kanji/樂에 들어오면 308로 楽 페이지로 보낸다", async ({ page }) => {
    const res = await page.request.get(kanjiPath("樂"), { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toContain(convertedPath("楽", "樂"));

    await page.goto(kanjiPath("樂"));
    await expect(page).toHaveURL(convertedPath("楽", "樂"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("楽");
    await expect(page.getByRole("note")).toContainText("한국 樂 → 일본 楽");
  });

  test("한국 표준 자형이 아닌 구자체는 '구자체'라고 안내한다 (插 → 挿)", async ({ page }) => {
    await page.goto(kanjiPath("插"));

    await expect(page).toHaveURL(convertedPath("挿", "插"));
    await expect(page.getByRole("note")).toContainText("구자체 插 → 일본 挿");
  });

  test("from이 그 글자의 이체자가 아니면 배너를 띄우지 않는다", async ({ page }) => {
    for (const from of ["國", "<b>x</b>"]) {
      await page.goto(convertedPath("学", from));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("学");
      await expect(page.getByRole("note")).toHaveCount(0);
    }
  });

  test("코드포인트가 같은 글자(骨)는 그대로 두고 일본 글꼴로 보여준다", async ({ page }) => {
    await page.goto(kanjiPath("骨"));

    await expect(page).toHaveURL(kanjiPath("骨"));
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("骨");
    await expect(heading).toHaveAttribute("lang", "ja");
    await expect(heading).toHaveCSS("font-family", /Klee One/);
    await expect(page.getByRole("note")).toHaveCount(0);
  });
});
