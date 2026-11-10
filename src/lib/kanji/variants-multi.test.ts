// 신자체 후보가 여럿인 경우는 지금 데이터에 없어서 variants.json을 가짜로 바꿔 분기를 확인한다
import { describe, expect, it, vi } from "vitest";
import { normalizeToJapanese } from "./variants";

vi.mock("@/data/variants.json", () => ({
  default: { dataVersion: "test", toJapanese: { 甲: ["乙", "丙"], 丁: ["戊"] } },
}));

describe("normalizeToJapanese (후보가 여럿)", () => {
  it("고를 근거가 없으면 바꾸지 않는다", () => {
    expect(normalizeToJapanese("甲")).toEqual({ char: "甲" });
  });

  it("하나면 바꾼다", () => {
    expect(normalizeToJapanese("丁")).toEqual({ char: "戊", from: "丁" });
  });
});
