import { describe, expect, it } from "vitest";
import { SAMPLE_CARD } from "./__fixtures__/card-v1";
import { furiganaWord, parseCardV1 } from "./card-v1";
import {
  cardPasses,
  checkFurigana,
  checkKoDiff,
  checkKun,
  checkKunNotation,
  checkOn,
  checkWords,
  jmdictIndex,
  percentile,
  runChecks,
  type Truth,
} from "./checks";

// KANJIDIC2 값 (evals/kanji-truth.json과 같은 형식)
const SHOKU: Truth = { literal: "職", on: ["ショク", "ソク"], kun: [], meanings_en: ["post", "employment", "work"] };
const GAKU: Truth = { literal: "学", on: ["ガク"], kun: ["まな.ぶ"], meanings_en: ["study", "learning", "science"] };

const JMDICT_SHOKU = jmdictIndex([
  { variants: [{ written: "職業", pronounced: "しょくぎょう" }] },
  { variants: [{ written: "就職", pronounced: "しゅうしょく" }] },
]);

const card = (lines: string) => parseCardV1(lines);

describe("parseCardV1", () => {
  it("v1 카드를 읽기·단어·예문으로 나눈다", () => {
    const c = parseCardV1(SAMPLE_CARD);
    expect(c.on).toEqual(["ショク"]);
    expect(c.kun).toEqual([]);
    expect(c.meaningKo).toBe("직업, 일");
    expect(c.koDiff).toBe("같음");
    expect(c.words).toEqual([
      { source: "{職業|しょくぎょう}", written: "職業", reading: "しょくぎょう", gloss: "직업" },
      { source: "{就職|しゅうしょく}", written: "就職", reading: "しゅうしょく", gloss: "취직" },
    ]);
    expect(c.example).toEqual({ source: "{職|しょく}を{探|さが}す。", ja: "職を探す。", ko: "일자리를 찾는다." });
  });

  it("음독·훈독이 다른 줄이거나 音読 라벨이어도 읽기를 읽어 낸다 (형식은 format이 따로 본다)", () => {
    expect(card("**음독** レキ\n**훈독** -")).toMatchObject({ on: ["レキ"], kun: [] });
    expect(card("**音読** リ\n**訓読** は(く)")).toMatchObject({ on: ["リ"], kun: ["は(く)"] });
    expect(card("**음독** リ · **훈독** ことわり、(-)").kun).toEqual(["ことわり"]);
  });

  it("단어·예문 라벨이 일본어여도 읽는다 (v1 기준선의 職 사례)", () => {
    const c = card("**よく使う単語**:\n- {転職|てんしょく} — 이직\n\n**例文**: {私|わたし}です。 → 저입니다.");
    expect(c.words.map((w) => w.written)).toEqual(["転職"]);
    expect(c.example?.ja).toBe("私です。");
    expect(checkWords(card("**뜻**: 직업"), "職", JMDICT_SHOKU).pass).toBeNull();
  });

  it("음독이 여럿이면 「、」로 나누고, 오쿠리가나는 표기·읽기에 붙인다", () => {
    expect(card("**음독** ショク、ソク · **훈독** まなぶ").on).toEqual(["ショク", "ソク"]);
    expect(furiganaWord("{学|まな}ぶ")).toEqual({ written: "学ぶ", reading: "まなぶ" });
  });
});

describe("결정적 검사", () => {
  it("샘플 카드는 모든 검사를 통과한다", () => {
    const results = runChecks(SAMPLE_CARD, parseCardV1(SAMPLE_CARD), SHOKU, { forms: ["職"], diff: "same" }, JMDICT_SHOKU);
    expect(results.filter((r) => r.pass === false)).toEqual([]);
    expect(cardPasses(results)).toBe(true);
  });

  it("사전에 없는 음독·훈독은 실패 (해커톤: 職 훈독 しごと)", () => {
    expect(checkOn(card("**음독** シキ · **훈독** -"), SHOKU).pass).toBe(false);
    expect(checkKun(card("**음독** ショク · **훈독** しごと"), SHOKU).pass).toBe(false);
  });

  it("훈독은 사전형으로 비교하고, 「-」(모름)는 통과", () => {
    expect(checkKun(card("**음독** ガク · **훈독** まなぶ"), GAKU).pass).toBe(true);
    expect(checkKun(card("**음독** ガク · **훈독** -"), GAKU).pass).toBe(true);
  });

  it("훈독의 오쿠리가나 기호(うご-く · つか(える))는 떼고 읽기만 비교한다", () => {
    const UGOKU: Truth = { literal: "動", on: ["ドウ"], kun: ["うご.く", "うご.かす"], meanings_en: [] };
    expect(checkKun(card("**음독** ドウ · **훈독** うご-く、(うごかす)"), UGOKU).pass).toBe(true);
    // 기호 표기 자체는 참고 검사 kun-notation이 센다
    expect(checkKunNotation(card("**음독** ドウ · **훈독** うご-く")).pass).toBe(false);
    expect(checkKunNotation(card("**음독** ドウ · **훈독** うごく")).pass).toBe(true);
  });

  it("자형이 다른 글자는 한국 자형을 말해야 한다 (楽 → 樂)", () => {
    const ko = { forms: ["樂"], diff: "form" as const };
    expect(checkKoDiff(card("**한국 한자와 차이**: 楽 ↔ 樂"), "楽", ko).pass).toBe(true);
    expect(checkKoDiff(card("**한국 한자와 차이**: 같음"), "楽", ko).pass).toBe(false);
    // 한국 자형을 말해도 "같음"으로 시작하면 학습자는 같다고 읽는다 (v1 기준선의 歴 사례)
    expect(checkKoDiff(card("**한국 한자와 차이**: 같음 (樂 → 楽, 일본 신자체)"), "楽", ko).pass).toBe(false);
  });

  it("같은 글자에 '同じ' 같은 말이 섞여도 '같음'이면 통과 (v1 기준선의 職 사례)", () => {
    expect(checkKoDiff(card("**한국 한자와 차이**: 同じ(같음)"), "職", { forms: ["職"], diff: "same" }).pass).toBe(true);
  });

  it("같은 글자에 다른 자형을 내놓으면 실패, 뜻 차이 설명은 통과", () => {
    const ko = { forms: ["直"], diff: "same" as const };
    expect(checkKoDiff(card("**한국 한자와 차이**: 같음 (直)"), "直", ko).pass).toBe(true);
    expect(checkKoDiff(card("**한국 한자와 차이**: 한국에서는 '곧다' 뜻이 더 흔함"), "直", ko).pass).toBe(true);
    expect(checkKoDiff(card("**한국 한자와 차이**: 直 ↔ 眞"), "直", ko).pass).toBe(false);
    expect(checkKoDiff(card("**한국 한자와 차이**: 같음"), "込", { forms: [], diff: "none" }).pass).toBeNull();
  });

  it("후리가나 없는 한자·가나가 아닌 읽기는 실패", () => {
    const bad = card("**자주 쓰는 단어**:\n- 職業 — 직업\n**예문**: {職|shoku}を探す。 → x");
    const result = checkFurigana(bad);
    expect(result.pass).toBe(false);
    expect(result.detail).toContain("후리가나 없는 한자: 職業");
    expect(result.detail).toContain("읽기가 가나가 아님");
  });

  it("단어는 이 한자를 포함하고 JMdict 표기·읽기와 맞아야 한다", () => {
    const words = (w: string) => card(`**자주 쓰는 단어**:\n- ${w} — 뜻`);
    expect(checkWords(words("{職業|しょくぎょう}"), "職", JMDICT_SHOKU).pass).toBe(true);
    expect(checkWords(words("{職業|しょくご}"), "職", JMDICT_SHOKU).pass).toBe(false);
    expect(checkWords(words("{仕事|しごと}"), "職", JMDICT_SHOKU).detail).toContain("職 없음");
    expect(checkWords(words("{職業|しょくぎょう}"), "職", null).pass).toBeNull();
  });
});

describe("percentile", () => {
  it("p50·p95 (nearest-rank)", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(10);
    expect(percentile(xs, 95)).toBe(19);
  });
});
