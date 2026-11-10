import { expect, kanjiPath, STROKE_DATA, test } from "./fixtures";

// 실제 CDN(jsdelivr → unpkg) 스모크. 다른 spec은 로컬 획순 데이터를 쓰므로, CDN·패키지 변화는 여기서만 잡힌다
test("실제 CDN에서 획순 데이터를 받아 그린다", async ({ page }) => {
  await page.unroute(STROKE_DATA);

  await page.goto(kanjiPath("職"));
  await expect(page.getByText("총 18획")).toBeVisible({ timeout: 15_000 });

  await page.goto(kanjiPath("あ"));
  await expect(page.getByText("총 3획")).toBeVisible({ timeout: 15_000 });
});
