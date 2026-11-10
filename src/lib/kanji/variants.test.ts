import { describe, expect, it } from "vitest";
import variantsFile from "@/data/variants.json";
import { kanjiHref, normalizeToJapanese } from "./variants";

describe("normalizeToJapanese", () => {
  it("구자체·한국 자형 → 신자체 + 원래 글자", () => {
    expect(normalizeToJapanese("學")).toEqual({ char: "学", from: "學" });
    expect(normalizeToJapanese("敎")).toEqual({ char: "教", from: "敎" });
  });

  it("신자체·가나·사전 밖 글자는 그대로", () => {
    for (const c of ["学", "あ", "薔", "constructor"]) expect(normalizeToJapanese(c)).toEqual({ char: c });
  });

  // 신자체가 여럿이면 바꾸지 않는다 — 그런 글자가 생기면 고르는 화면이 필요하다 (kanji-search 스킬)
  it("지금 데이터에는 신자체가 여럿인 글자가 없다", () => {
    for (const to of Object.values(variantsFile.toJapanese)) expect(to).toHaveLength(1);
  });
});

describe("kanjiHref", () => {
  it("바꾼 글자면 from을 붙인다", () => {
    expect(kanjiHref({ char: "学", from: "學" })).toBe("/kanji/%E5%AD%A6?from=%E5%AD%B8");
    expect(kanjiHref({ char: "学" })).toBe("/kanji/%E5%AD%A6");
  });
});
