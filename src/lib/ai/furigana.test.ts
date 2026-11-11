import { describe, expect, it } from "vitest";
import { parseFurigana, plainText, toHiragana, wordFurigana } from "./furigana";

describe("parseFurigana", () => {
  it("{漢字|よみ}를 ruby 토큰으로 바꾼다", () => {
    expect(parseFurigana("{面接|めんせつ}を受ける")).toEqual([
      { type: "ruby", base: "面接", reading: "めんせつ" },
      { type: "text", text: "を受ける" },
    ]);
  });

  it("앞뒤 글자와 여러 ruby를 순서대로 나눈다", () => {
    expect(parseFurigana("明日、{職|しょく}を{探|さが}す。")).toEqual([
      { type: "text", text: "明日、" },
      { type: "ruby", base: "職", reading: "しょく" },
      { type: "text", text: "を" },
      { type: "ruby", base: "探", reading: "さが" },
      { type: "text", text: "す。" },
    ]);
  });

  it("후리가나가 없으면 글자 토큰 하나, 빈 문자열이면 없음", () => {
    expect(parseFurigana("ありがとう")).toEqual([{ type: "text", text: "ありがとう" }]);
    expect(parseFurigana("")).toEqual([]);
  });

  it("스트리밍 중 아직 닫히지 않은 중괄호는 글자로 남긴다", () => {
    expect(parseFurigana("{面接|めんせ")).toEqual([{ type: "text", text: "{面接|めんせ" }]);
  });
});

describe("plainText · toHiragana", () => {
  it("후리가나 표기를 벗긴다", () => {
    expect(plainText("{学校|がっこう}に{行|い}く。")).toBe("学校に行く。");
  });
  it("가타카나를 히라가나로", () => {
    expect(toHiragana("ガクセイ・クラブー")).toBe("がくせい・くらぶー");
  });
});

describe("wordFurigana (단어 루비)", () => {
  it("한자만이면 통째로", () => {
    expect(wordFurigana("学校", "がっこう")).toEqual([{ type: "ruby", base: "学校", reading: "がっこう" }]);
  });
  it("오쿠리가나·접두 가나는 루비 밖", () => {
    expect(wordFurigana("楽しい", "たのしい")).toEqual([
      { type: "ruby", base: "楽", reading: "たの" },
      { type: "text", text: "しい" },
    ]);
    expect(wordFurigana("お話", "おはなし")).toEqual([
      { type: "text", text: "お" },
      { type: "ruby", base: "話", reading: "はなし" },
    ]);
  });
  it("가운데 가나는 그대로 둔다 (話し合い)", () => {
    expect(wordFurigana("話し合い", "はなしあい")).toEqual([{ type: "ruby", base: "話し合", reading: "はなしあ" }, { type: "text", text: "い" }]);
  });
  it("가타카나 읽기도 받는다 (倶楽部 クラブ)", () => {
    expect(wordFurigana("倶楽部", "クラブ")).toEqual([{ type: "ruby", base: "倶楽部", reading: "クラブ" }]);
  });
});
