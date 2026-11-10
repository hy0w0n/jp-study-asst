import { afterEach, describe, expect, it, vi } from "vitest";
import a from "./__fixtures__/あ.json";
import nu from "./__fixtures__/ぬ.json";
import { isKana, isKanji, loadCharData, mergeSplitStrokes, safeDecode, type CharData } from "./loader";

// 픽스처: @k1low/hanzi-writer-data-jp@0.8.0 원본 (조각 획이 나뉜 상태)
const FAKE: CharData = { strokes: ["M 0 0 L 1 1"], medians: [[[0, 0], [1, 1]]] };

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const notFound = () => new Response("Not Found", { status: 404 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isKanji · isKana", () => {
  it("한자와 가나를 구분한다", () => {
    expect(isKanji("職")).toBe(true);
    expect(isKanji("あ")).toBe(false);
    expect(isKana("あ")).toBe(true);
    expect(isKana("ア")).toBe(true);
    expect(isKana("職")).toBe(false);
  });

  it("한글·영문은 둘 다 아니다", () => {
    for (const s of ["직", "A"]) {
      expect(isKanji(s)).toBe(false);
      expect(isKana(s)).toBe(false);
    }
  });
});

describe("safeDecode", () => {
  it("인코딩된 라우트 파라미터를 글자로 되돌린다", () => {
    expect(safeDecode("%E8%81%B7")).toBe("職");
    expect(safeDecode("職")).toBe("職");
  });

  it("깨진 인코딩은 그대로 둔다", () => {
    expect(safeDecode("%E8%81")).toBe("%E8%81");
  });
});

describe("mergeSplitStrokes", () => {
  it("あ: 조각 4개를 3획으로 합친다", () => {
    expect(a.strokes).toHaveLength(4);
    const merged = mergeSplitStrokes(a);
    expect(merged.strokes).toHaveLength(3);
    expect(merged.medians).toHaveLength(3);
  });

  it("ぬ: 조각 4개를 2획으로 합친다", () => {
    expect(nu.strokes).toHaveLength(4);
    const merged = mergeSplitStrokes(nu);
    expect(merged.strokes).toHaveLength(2);
    expect(merged.medians).toHaveLength(2);
  });

  it("합친 획도 원래 조각의 윤곽을 모두 담는다", () => {
    const merged = mergeSplitStrokes(a);
    expect(merged.strokes.join(" ")).toBe(a.strokes.join(" "));
  });
});

describe("loadCharData", () => {
  it("첫 CDN이 실패하면 다음 CDN에서 받는다", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(json(FAKE));
    vi.stubGlobal("fetch", fetch);

    await expect(loadCharData("職")).resolves.toEqual(FAKE);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain("cdn.jsdelivr.net");
    expect(fetch.mock.calls[1][0]).toContain("unpkg.com");
  });

  it("어느 CDN에도 없으면 null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(notFound()));
    await expect(loadCharData("薔")).resolves.toBeNull();
  });

  it("가나는 받은 뒤 조각 획을 합친다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(a)));
    const data = await loadCharData("あ");
    expect(data?.strokes).toHaveLength(3);
  });

  it("같은 글자는 한 번만 요청한다", async () => {
    const fetch = vi.fn().mockImplementation(async () => json(FAKE));
    vi.stubGlobal("fetch", fetch);

    await Promise.all([loadCharData("必"), loadCharData("必")]);
    await loadCharData("必");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
