import { describe, expect, it } from "vitest";
import { extractChars, searchHits } from "./search";

describe("extractChars", () => {
  it("단어를 글자로 나눈다", () => {
    expect(extractChars("履歴書")).toEqual(["履", "歴", "書"]);
  });

  it("가나도 뽑고, 중복은 지우되 처음 나온 순서를 지킨다", () => {
    expect(extractChars("職業の職")).toEqual(["職", "業", "の"]);
    expect(extractChars("アイ")).toEqual(["ア", "イ"]);
  });

  it("한글·영문·숫자·기호는 버린다", () => {
    expect(extractChars("직업 job 123!")).toEqual([]);
    expect(extractChars("면접(面接)")).toEqual(["面", "接"]);
  });
});

describe("searchHits", () => {
  it("한국 자형·구자체는 일본 신자체로 바꾸고 원래 글자를 남긴다", () => {
    expect(searchHits("學國樂")).toEqual([
      { char: "学", from: "學" },
      { char: "国", from: "國" },
      { char: "楽", from: "樂" },
    ]);
  });

  it("신자체·가나는 그대로 둔다", () => {
    expect(searchHits("学校の")).toEqual([{ char: "学" }, { char: "校" }, { char: "の" }]);
  });

  it("바꾼 뒤 같은 글자가 되면 하나만 남긴다", () => {
    expect(searchHits("學学")).toEqual([{ char: "学", from: "學" }]);
    expect(searchHits("学學")).toEqual([{ char: "学" }]);
  });

  it("코드포인트가 같고 글꼴만 다른 글자(骨·直)는 바꾸지 않는다", () => {
    expect(searchHits("骨直")).toEqual([{ char: "骨" }, { char: "直" }]);
  });
});
