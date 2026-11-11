import { describe, expect, it } from "vitest";
import { SAMPLE_CARD } from "../cards/__fixtures__/kanji-card";
import type { KanjiEntry } from "../kanji/data";
import { parseCardV1 } from "./card-v1";
import { cardPasses, jmdictIndex, runChecks, type Truth } from "./checks";
import { renderCardText } from "./card-v2";

// kanji.json의 職 (KANJIDIC2 + Unihan)
const SHOKU_ENTRY: KanjiEntry = {
  on: ["ショク", "ソク"],
  kun: [],
  koReading: ["직"],
  ko: { forms: ["職"], diff: "same", basis: "self" },
  oldForms: [],
  meaningsEn: ["post", "employment", "work"],
  grade: 5,
  jlptOld: 2,
  strokes: [18],
  freq: 241,
};
const SHOKU: Truth = { literal: "職", on: ["ショク", "ソク"], kun: [], meanings_en: ["post", "employment", "work"] };

describe("renderCardText", () => {
  const text = renderCardText(SHOKU_ENTRY, SAMPLE_CARD);

  it("사전 사실 + AI 부분을 v1 라벨 형식으로 그린다", () => {
    expect(text).toBe(`**음독** ショク、ソク · **훈독** -
**뜻**: 직업, 일
**한국 한자와 차이**: 같음
**자주 쓰는 단어**:
- {就職|しゅうしょく} — 취직
- {職場|しょくば} — 직장
**예문**: {来年|らいねん}、IT{企業|きぎょう}に{就職|しゅうしょく}したい。 → 내년에 IT 기업에 취직하고 싶다.`);
  });

  it("v1 검사를 그대로 통과한다 (화면의 카드를 같은 잣대로)", () => {
    const jmdict = jmdictIndex([
      { variants: [{ written: "就職", pronounced: "しゅうしょく" }] },
      { variants: [{ written: "職場", pronounced: "しょくば" }] },
    ]);
    const results = runChecks(text, parseCardV1(text), SHOKU, SHOKU_ENTRY.ko, jmdict);
    expect(cardPasses(results)).toBe(true);
    expect(results.find((r) => r.name === "example-has-char")?.pass).toBe(true);
  });

  it("한국 자형이 다르면 한국 자형을 말한다 (学 → 學)", () => {
    const gaku = { ...SHOKU_ENTRY, ko: { forms: ["學"], diff: "form" as const, basis: "old" as const } };
    expect(renderCardText(gaku, SAMPLE_CARD)).toContain("**한국 한자와 차이**: 다름 — 한국 學");
  });
});
