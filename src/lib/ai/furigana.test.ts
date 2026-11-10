import { describe, expect, it } from "vitest";
import { parseFurigana } from "./furigana";

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
