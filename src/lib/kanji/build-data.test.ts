import { describe, expect, it } from "vitest";
import {
  buildEntry,
  buildTwinIndex,
  buildVariantIndex,
  koReadingsOf,
  koreanForm,
  parseCodepoints,
  parseHangul,
  parseUnihan,
  splitKun,
  type Kanjidic2Char,
} from "./build-data";
import type { KanjiEntry } from "./data";

describe("splitKun", () => {
  it("오쿠리가나를 나눈다", () => {
    expect(splitKun("まな.ぶ")).toEqual({ reading: "まなぶ", stem: "まな", okurigana: "ぶ" });
  });
  it("점이 없으면 통째로 어간", () => {
    expect(splitKun("あお")).toEqual({ reading: "あお", stem: "あお" });
  });
  it("접두·접미 표시 -는 보존한다", () => {
    expect(splitKun("あお-")).toEqual({ reading: "あお-", stem: "あお-" });
  });
});

describe("Unihan 값 파싱", () => {
  it("코드포인트 목록에서 꺾쇠 출처 표시를 버린다", () => {
    expect(parseCodepoints("U+5713 U+654E<kLau,kMatthews")).toEqual(["圓", "敎"]);
    expect(parseCodepoints(undefined)).toEqual([]);
  });
  it("kHangul의 출처 표시를 버리고 음만 남긴다", () => {
    expect(parseHangul("낙:0 락:0E 악:0N 요:0N")).toEqual(["낙", "락", "악", "요"]);
  });
});

// 값은 Unihan 18.0 원본 (豫·樂·行·辨辯瓣·塡)
describe("koReadingsOf (한국 음 순서)", () => {
  it("교육용(E) > KS X 1001(0) 순서, 같으면 Unihan 순서", () => {
    expect(koReadingsOf(["낙:0 락:0E 악:0N 요:0N"])).toEqual(["락", "낙", "악", "요"]);
    expect(koReadingsOf(["항:0N 행:0E"])).toEqual(["행", "항"]);
  });
  it("인명용(N)에만 있는 음은 뺀다 (予 → 豫: 서 아님)", () => {
    expect(koReadingsOf(["서:N 예:0E"])).toEqual(["예"]);
    expect(koReadingsOf(["전:0N 진:N"])).toEqual(["전"]);
  });
  it("한국 표준 음이 하나도 없으면 있는 음을 그대로", () => {
    expect(koReadingsOf(["서:N"])).toEqual(["서"]);
  });
  it("여러 자형의 음은 합치고 중복을 지운다 (弁 → 辨·辯·瓣)", () => {
    expect(koReadingsOf(["변:0E", "변:0E", "판:0N"])).toEqual(["변", "판"]);
    expect(koReadingsOf([undefined])).toEqual([]);
  });
});

// Unihan 18.0 원본에서 옮긴 줄 (필요한 속성만)
const UNIHAN = parseUnihan([
  [
    "# 주석 줄은 건너뛴다",
    "U+5186\tkJapaneseOldVariant\tU+5713", // 円 → 圓
    "U+5186\tkIRG_KSource\tK0-6577",
    "U+5713\tkIRG_KSource\tK0-6A2D",
    "U+5713\tkKoreanEducationHanja\t2007",
    "U+5713\tkHangul\t원:0E",
    "U+6B04\tkJapaneseOldVariant\tU+F91D", // 欄 → 호환 한자 欄
    "U+6B04\tkIRG_KSource\tK0-5576",
    "U+F91D\tkIRG_KSource\tK0-4C6E",
    "U+6559\tkSemanticVariant\tU+654E<kLau,kMatthews", // 教 → 敎 (부수 같음)
    "U+6559\tkRSUnicode\t66.7",
    "U+654E\tkRSUnicode\t66.7",
    "U+654E\tkIRG_KSource\tK0-4E67",
    "U+54B2\tkSemanticVariant\tU+7B11<kFenn", // 咲 → 笑 (부수 다름)
    "U+54B2\tkRSUnicode\t30.6",
    "U+7B11\tkRSUnicode\t118.4",
    "U+7B11\tkIRG_KSource\tK0-7031",
    "U+4E3C\tkSpecializedSemanticVariant\tU+4E95", // 丼 → 井 (뜻 일부만)
    "U+4E95\tkIRG_KSource\tK0-7058",
    "U+9752\tkRSUnicode\t174.0", // 青: 연결 없음, 靑과 부수·획수·음 같음
    "U+9752\tkTotalStrokes\t8",
    "U+9751\tkRSUnicode\t174.0",
    "U+9751\tkTotalStrokes\t8",
    "U+9751\tkIRG_KSource\tK0-746C",
    "U+9751\tkHangul\t청:0E",
    "U+67FF\tkRSUnicode\t75.5", // 柿: 枾·枲 둘 다 해당 → 고르지 않는다
    "U+67FF\tkTotalStrokes\t9",
    "U+67BE\tkRSUnicode\t75.5",
    "U+67BE\tkTotalStrokes\t9",
    "U+67BE\tkIRG_KSource\tK0-6342",
    "U+67BE\tkHangul\t시:0N",
    "U+67B2\tkRSUnicode\t75.5",
    "U+67B2\tkTotalStrokes\t9",
    "U+67B2\tkIRG_KSource\tK0-6343",
    "U+67B2\tkHangul\t시:0N",
  ].join("\n"),
]);
const TWINS = buildTwinIndex(UNIHAN);
const ko = (x: string, readings: string[] = []) => koreanForm(UNIHAN, x, readings, TWINS);

describe("koreanForm (한국 자형)", () => {
  it("신자체 자신이 KS X 1001에 있어도 구자체가 있으면 구자체 (円 → 圓)", () => {
    expect(ko("円")).toEqual({ forms: ["圓"], diff: "form", basis: "old" });
  });
  it("CJK 호환 한자 구자체는 무시하고 글자 자신 (欄)", () => {
    expect(ko("欄")).toEqual({ forms: ["欄"], diff: "same", basis: "self" });
  });
  it("부수가 같은 의미 이체자는 쓴다 (教 → 敎)", () => {
    expect(ko("教")).toEqual({ forms: ["敎"], diff: "form", basis: "variant" });
  });
  it("부수가 다른 의미 이체자는 쓰지 않는다 (咲 → 笑 아님)", () => {
    expect(ko("咲", ["소"])).toEqual({ forms: [], diff: "none", basis: null });
  });
  it("뜻이 일부만 겹치는 이체자는 쓰지 않는다 (丼 → 井 아님)", () => {
    expect(ko("丼", ["정"])).toEqual({ forms: [], diff: "none", basis: null });
  });
  it("Unihan에 연결이 없으면 부수·획수·한국 음이 같은 글자 (青 → 靑)", () => {
    expect(ko("青", ["청"])).toEqual({ forms: ["靑"], diff: "form", basis: "twin" });
  });
  it("그런 글자가 둘 이상이면 고르지 않는다 (柿)", () => {
    expect(ko("柿", ["시"])).toEqual({ forms: [], diff: "none", basis: null });
  });
});

// 한국 음 = 한국 자형의 kHangul. 일본 글자 자체의 한국 음(芸 운)은 다른 글자의 음이라 섞지 않고,
// KANJIDIC2 korean_h(옛 음 효 등이 섞임)는 한국 자형이 없을 때만 쓴다 (docs/ACCURACY.md 4장)
describe("buildEntry (한국 음)", () => {
  const U = parseUnihan([
    [
      "U+82B8\tkJapaneseOldVariant\tU+85DD", // 芸 → 藝
      "U+82B8\tkIRG_KSource\tK0-697D",
      "U+82B8\tkHangul\t예:N 운:0N",
      "U+85DD\tkIRG_KSource\tK0-675D",
      "U+85DD\tkKoreanEducationHanja\t2007",
      "U+85DD\tkHangul\t예:0E",
      "U+6821\tkIRG_KSource\tK0-4E68", // 校
      "U+6821\tkKoreanEducationHanja\t2007",
      "U+6821\tkHangul\t교:0E",
      "U+54B2\tkSemanticVariant\tU+7B11<kFenn", // 咲: 한국 자형 없음
      "U+54B2\tkHangul\t소:N",
    ].join("\n"),
  ]);
  const twins = buildTwinIndex(U);
  const kd = (literal: string, readings: [string, string][]): Kanjidic2Char => ({
    literal,
    misc: { grade: 8, strokeCounts: [7], frequency: null, jlptLevel: null },
    readingMeaning: { groups: [{ readings: readings.map(([type, value]) => ({ type, value })), meanings: [] }] },
  });

  it("구자체가 있으면 구자체의 음만 (芸 → 藝 예, 운 아님)", () => {
    const e = buildEntry(kd("芸", [["korean_h", "운"], ["korean_h", "예"], ["ja_on", "ゲイ"]]), U, twins);
    expect(e.ko).toEqual({ forms: ["藝"], diff: "form", basis: "old" });
    expect(e.koReading).toEqual(["예"]);
  });
  it("같은 글자면 Unihan 음만 (校 교, KANJIDIC2의 효는 버림)", () => {
    const e = buildEntry(kd("校", [["korean_h", "교"], ["korean_h", "효"]]), U, twins);
    expect(e.koReading).toEqual(["교"]);
  });
  it("한국 자형이 없으면 KANJIDIC2 korean_h (咲 소)", () => {
    const e = buildEntry(kd("咲", [["korean_h", "소"], ["ja_kun", "さ.く"]]), U, twins);
    expect(e.ko.diff).toBe("none");
    expect(e.koReading).toEqual(["소"]);
    expect(e.kun).toEqual([{ reading: "さく", stem: "さ", okurigana: "く" }]);
  });
  it("readingMeaning이 없으면 읽기·뜻이 빈 배열", () => {
    const e = buildEntry({ ...kd("〇", []), readingMeaning: null }, U, twins);
    expect([e.on, e.kun, e.koReading, e.meaningsEn]).toEqual([[], [], [], []]);
  });
});

describe("buildVariantIndex", () => {
  const entry = (oldForms: string[], forms: string[]) =>
    ({ oldForms, ko: { forms, diff: "form", basis: "old" } }) as unknown as KanjiEntry;

  it("구자체·한국 자형 → 신자체, 여러 신자체로 가면 모두 남긴다", () => {
    const index = buildVariantIndex({ 学: entry(["學"], ["學"]), 弁: entry(["辨"], ["辨"]), 辧: entry([], ["辨"]) });
    expect(index).toEqual({ 學: ["学"], 辨: ["弁", "辧"] });
  });
  it("목록 안의 일본 글자는 키가 되지 않는다", () => {
    expect(buildVariantIndex({ 甲: entry([], ["乙"]), 乙: entry([], ["乙"]) })).toEqual({});
  });
});
