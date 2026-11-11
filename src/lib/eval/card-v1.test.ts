import { describe, expect, it } from "vitest";
import { SAMPLE_CARD as CARD } from "./__fixtures__/card-v1";
import { isCompleteCard } from "./card-v1";

describe("isCompleteCard", () => {
  it("라벨 5개와 예문 번역까지 있으면 완성 (E2E 목 카드도 이 카드)", () => {
    expect(isCompleteCard(CARD)).toBe(true);
  });

  it("예문 번역 전에 잘린 응답은 미완성", () => {
    expect(isCompleteCard(CARD.replace(/ → .*$/, ""))).toBe(false);
    expect(isCompleteCard(CARD.replace(/ → .*$/, " → "))).toBe(false);
  });

  it("번역이 다음 줄로 넘어가면 미완성", () => {
    expect(isCompleteCard(CARD.replace(" → ", "\n→ "))).toBe(false);
  });

  it("라벨이 바뀌면(音読み) 미완성", () => {
    expect(isCompleteCard(CARD.replace("**음독**", "**音読み**"))).toBe(false);
  });

  it("빠진 라벨이 있으면 미완성", () => {
    expect(isCompleteCard(CARD.replace("**한국 한자와 차이**: 같음\n", ""))).toBe(false);
  });
});
