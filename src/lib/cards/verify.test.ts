import { describe, expect, it } from "vitest";
import { SAMPLE_CARD, SHOKU_CANDIDATES } from "./__fixtures__/kanji-card";
import type { CardJudgement, KanjiCardAi } from "./schema";
import type { KanjiEntry } from "../kanji/data";
import { judgeRule, passed, problemsOf, readingForms, verifyCard } from "./verify";

const ctx = { char: "職", candidates: SHOKU_CANDIDATES };
// kanji.json 값 (KANJIDIC2)
const DICT: Record<string, Pick<KanjiEntry, "on" | "kun">> = {
  職: { on: ["ショク", "ソク"], kun: [] },
  探: { on: ["タン"], kun: [{ reading: "さぐる", stem: "さぐ", okurigana: "る" }, { reading: "さがす", stem: "さが", okurigana: "す" }] },
  学: { on: ["ガク"], kun: [{ reading: "まなぶ", stem: "まな", okurigana: "ぶ" }] },
  本: { on: ["ホン"], kun: [{ reading: "もと", stem: "もと" }] },
};
const withCard = (patch: Partial<KanjiCardAi>): KanjiCardAi => ({ ...SAMPLE_CARD, ...patch });
const failed = (raw: unknown, c = ctx) => {
  const { results } = verifyCard(raw, c);
  return Object.fromEntries(results.filter((r) => !r.pass).map((r) => [r.rule, r.detail]));
};
const example = (ja: string, ko = "번역") => withCard({ example: { ja, ko } });

describe("verifyCard", () => {
  it("샘플 카드는 규칙 1~4·6을 모두 통과한다", () => {
    const { card, results } = verifyCard(SAMPLE_CARD, ctx);
    expect(passed(results)).toBe(true);
    expect(card).toEqual(SAMPLE_CARD);
  });

  it("앞뒤 공백은 지워서 돌려준다", () => {
    const { card } = verifyCard(withCard({ meaningKo: "  직업, 일 " }), ctx);
    expect(card?.meaningKo).toBe("직업, 일");
  });

  describe("규칙 1 스키마", () => {
    it("JSON 모양이 다르면 나머지 규칙은 보지 않는다", () => {
      expect(verifyCard(null, ctx)).toEqual({ card: null, results: [{ rule: "schema", pass: false, detail: "JSON 스키마와 맞지 않음" }] });
      expect(verifyCard({ meaningKo: "직업" }, ctx).card).toBeNull();
    });
    it("단어 수는 min(2, 후보 수)", () => {
      expect(failed(withCard({ words: SAMPLE_CARD.words.slice(0, 1) }))).toHaveProperty("schema");
      // 후보가 1개뿐인 글자(虎)는 1개
      const tora = { char: "虎", candidates: [["虎", "とら", "tiger"]] as typeof SHOKU_CANDIDATES };
      const card = { meaningKo: "범, 호랑이", words: [{ written: "虎", reading: "とら", meaningKo: "호랑이" }], example: { ja: "{虎|とら}は{強|つよ}い。", ko: "호랑이는 강하다." } };
      expect(passed(verifyCard(card, tora).results)).toBe(true);
      // 후보가 없는 글자는 단어 없이
      expect(passed(verifyCard({ ...card, words: [] }, { char: "虎", candidates: [] }).results)).toBe(true);
    });
    it("빈 칸·너무 긴 칸·줄바꿈", () => {
      expect(failed(withCard({ meaningKo: "" }))).toHaveProperty("schema");
      expect(failed(withCard({ meaningKo: "가".repeat(21) }))).toHaveProperty("schema");
      expect(failed(example("{就職|しゅうしょく}した。\n{職場|しょくば}だ。"))).toHaveProperty("schema");
    });
  });

  describe("규칙 2 단어", () => {
    it("후보에 없는 단어 (해커톤: 職 → 仕事)", () => {
      const words = [{ written: "仕事", reading: "しごと", meaningKo: "일" }, SAMPLE_CARD.words[1]];
      expect(failed(withCard({ words })).words).toContain("「仕事」은 [단어 후보]에 없음");
    });
    it("읽기를 바꾸면 실패", () => {
      const words = [{ written: "就職", reading: "しゅうしょっく", meaningKo: "취직" }, SAMPLE_CARD.words[1]];
      expect(failed(withCard({ words })).words).toContain("읽기는 しゅうしょく");
    });
    it("같은 단어 두 번", () => {
      expect(failed(withCard({ words: [SAMPLE_CARD.words[0], SAMPLE_CARD.words[0]] })).words).toContain("두 번");
    });
  });

  describe("규칙 3 후리가나", () => {
    it("후리가나 없는 한자", () => {
      expect(failed(example("{来年|らいねん}、IT企業に{就職|しゅうしょく}したい。")).furigana).toContain("企業");
    });
    it("읽기가 가나가 아님 · 중괄호 짝", () => {
      expect(failed(example("{就職|shuushoku}した。")).furigana).toContain("가나만");
      expect(failed(example("{就職|しゅうしょく}した{。")).furigana).toContain("중괄호");
    });
    it("후보 단어를 통째로 묶었으면 읽기가 후보와 같아야 한다", () => {
      expect(failed(example("{職場|しょっば}に{行|い}く。")).furigana).toContain("사전 읽기는 しょくば");
    });
    it("한 글자 묶음은 그 한자의 사전 읽기와 대조한다 (해커톤: 職 → しごと)", () => {
      const lookup = (c: string) => (DICT[c] ?? null);
      const shokuWithDict = { ...ctx, lookup };
      expect(failed(example("{職|しごと}を{探|さが}す。"), shokuWithDict).furigana).toContain("{職|しごと}: 사전에 없는 읽기");
      expect(passed(verifyCard(example("{職|しょく}を{探|さが}す。"), shokuWithDict).results)).toBe(true);
      // 사전 데이터가 없는 글자(상용한자 밖·IT 같은 글자 아닌 묶음)는 대조하지 않는다
      expect(passed(verifyCard(example("{職|しょく}を{IT|アイティー}で{探|さが}す。"), shokuWithDict).results)).toBe(true);
    });
    it("한 글자 묶음은 후보 단어와 비교하지 않는다 ({楽|たの}しい ≠ 楽 らく)", () => {
      const raku = { char: "楽", candidates: [["楽", "らく", "comfort"], ["楽しい", "たのしい", "enjoyable"]] as typeof SHOKU_CANDIDATES };
      const card = { meaningKo: "즐겁다", words: [{ written: "楽しい", reading: "たのしい", meaningKo: "즐겁다" }, { written: "楽", reading: "らく", meaningKo: "편함" }], example: { ja: "{旅行|りょこう}は{楽|たの}しい。", ko: "여행은 즐겁다." } };
      expect(passed(verifyCard(card, raku).results)).toBe(true);
    });
  });

  it("규칙 4: 예문에 이 한자가 없음", () => {
    expect(failed(example("{会社|かいしゃ}に{行|い}く。"))).toHaveProperty("example");
  });

  describe("규칙 6 금칙", () => {
    it("한국어 칸의 가나·읽기·자형 판단 (해커톤: 職 \"간체 职과 다름\")", () => {
      expect(failed(withCard({ meaningKo: "직업(しょく)" })).forbidden).toContain("가나");
      expect(failed(withCard({ meaningKo: "직업, 간체와 다름" })).forbidden).toContain("자형");
      expect(failed(withCard({ meaningKo: "직업 (음독 쇼쿠)" })).forbidden).toContain("읽기");
    });
    it("일본어 예문에 한글", () => {
      expect(failed(example("{就職|しゅうしょく}한다。"))).toHaveProperty("forbidden");
    });
  });

  it("problemsOf는 재생성 프롬프트에 붙일 사유를 돌려준다", () => {
    const { results } = verifyCard(example("{会社|かいしゃ}に{行|い}く。"), ctx);
    expect(problemsOf(results)).toEqual(["example: 예문에 職가 없음"]);
  });
});

describe("readingForms (한 글자의 사전 읽기 + 연탁·촉음)", () => {
  it("음독(히라가나)·훈독 전체와 어간", () => {
    const forms = readingForms(DICT["学"]);
    for (const r of ["がく", "まなぶ", "まな"]) expect(forms.has(r)).toBe(true);
  });
  it("촉음 (学校 がっこう의 学 がっ) · 연탁 (三本 さんぼん의 本 ぼん, 一本 いっぽん의 本 ぽん)", () => {
    expect(readingForms(DICT["学"]).has("がっ")).toBe(true);
    const hon = readingForms(DICT["本"]);
    expect(hon.has("ぼん")).toBe(true);
    expect(hon.has("ぽん")).toBe(true);
  });
  it("접두·접미 표시(-)는 뗀다", () => {
    expect(readingForms({ on: [], kun: [{ reading: "-こむ", stem: "-こ", okurigana: "む" }] }).has("こむ")).toBe(true);
  });
  it("사전에 없는 읽기는 없다", () => {
    expect(readingForms(DICT["職"]).has("しごと")).toBe(false);
  });
});

describe("judgeRule (규칙 5)", () => {
  const judgement = (meaning: number, words = 5, translation = 5): CardJudgement => ({
    meaning: { score: meaning, reason: "뜻 이유" },
    words: { score: words, reason: "단어 이유" },
    translation: { score: translation, reason: "번역 이유" },
  });
  it("세 항목이 모두 3점 이상이면 통과", () => {
    expect(judgeRule(judgement(3, 4, 5)).pass).toBe(true);
  });
  it("하나라도 3점 미만이면 실패하고 이유를 남긴다", () => {
    expect(judgeRule(judgement(5, 5, 2))).toEqual({ rule: "judge", pass: false, detail: "translation 2점: 번역 이유" });
  });
  it("1~5 정수가 아니면 실패", () => {
    expect(judgeRule(judgement(4.5)).pass).toBe(false);
    expect(judgeRule(judgement(6)).pass).toBe(false);
  });
});
