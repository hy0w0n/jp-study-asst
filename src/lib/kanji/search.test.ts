import { describe, expect, it } from "vitest";
import { extractChars } from "./search";

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
