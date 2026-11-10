// 커밋된 src/data/ 산출물을 검사한다. 기대값은 KANJIDIC2 2026-11-09 · Unihan 18.0 원본에서 확인했다.
import { describe, expect, it } from "vitest";
import kanjiFile from "@/data/kanji.json";
import variantsFile from "@/data/variants.json";
import { getKanji, japaneseFormsOf } from "./data";
import { KO_FORM_SAMPLES } from "./samples";

describe("kanji.json", () => {
  it("상용한자 2,136자", () => {
    expect(Object.keys(kanjiFile.kanji)).toHaveLength(2136);
  });

  it("学: ガク · まな.ぶ · 학 · 學 · 1학년 · 8획", () => {
    const e = getKanji("学")!;
    expect(e.on).toEqual(["ガク"]);
    expect(e.kun).toEqual([{ reading: "まなぶ", stem: "まな", okurigana: "ぶ" }]);
    expect(e.koReading).toEqual(["학"]);
    expect(e.ko).toEqual({ forms: ["學"], diff: "form", basis: "old" });
    expect(e.grade).toBe(1);
    expect(e.strokes).toEqual([8]);
  });

  it("職: 훈독 없음 (해커톤 때 AI가 しごと를 훈독으로 냈다)", () => {
    expect(getKanji("職")!.kun).toEqual([]);
    expect(getKanji("職")!.on).toEqual(["ショク", "ソク"]);
  });

  it.each(Object.entries(KO_FORM_SAMPLES))("%s의 한국 자형·한국 음", (char, expected) => {
    const e = getKanji(char)!;
    expect(e.ko.forms).toEqual(expected.forms);
    expect(e.ko.diff).toBe(expected.diff);
    expect(e.koReading).toEqual(expect.arrayContaining(expected.koReading));
  });

  it("일본에서 만든 글자는 한국 자형이 없다 (込·働·枠)", () => {
    for (const c of ["込", "働", "枠"]) expect(getKanji(c)!.ko.diff).toBe("none");
  });

  it("상용한자가 아니면 null", () => {
    expect(getKanji("學")).toBeNull();
    expect(getKanji("a")).toBeNull();
  });
});

describe("variants.json (구자체·한국 자형 → 신자체)", () => {
  it.each([
    ["學", "学"],
    ["國", "国"],
    ["敎", "教"],
    ["靑", "青"],
  ])("%s → %s", (from, to) => {
    expect(japaneseFormsOf(from)).toEqual([to]);
  });

  it("한 신자체로 모이는 구자체들 (辨·辯·瓣 → 弁)", () => {
    for (const c of ["辨", "辯", "瓣"]) expect(japaneseFormsOf(c)).toEqual(["弁"]);
  });

  it("신자체는 바꾸지 않는다", () => {
    expect(japaneseFormsOf("学")).toEqual([]);
  });

  it("키에 상용한자가 없고, 값은 모두 상용한자", () => {
    for (const [from, to] of Object.entries(variantsFile.toJapanese)) {
      expect(getKanji(from)).toBeNull();
      for (const x of to) expect(getKanji(x)).not.toBeNull();
    }
  });

  it("두 파일의 데이터 버전이 같다", () => {
    expect(variantsFile.dataVersion).toBe(kanjiFile.dataVersion);
  });
});
