// 검증을 통과한 v2 카드 한 장(職). 단위 테스트(verify·generate)와 E2E 목(e2e/fixtures.ts — 글자와 상관없이 이 카드)이 같이 쓴다 —
// 검증 규칙이 바뀌어 이 카드가 떨어지면 단위 테스트가 먼저 깨져서 E2E 목도 같이 고치게 된다
import type { WordCandidate } from "../../kanji/build-data";
import type { KanjiCardAi, KanjiCardResponse } from "../schema";

// src/data/words.json의 職 후보 앞 6개 (jmdict-2026-11-10)
export const SHOKU_CANDIDATES: WordCandidate[] = [
  ["職員", "しょくいん", "staff member; employee; worker"],
  ["汚職", "おしょく", "corruption (esp. by a government employee); bribery; graft"],
  ["現職", "げんしょく", "present post; current office; (an) incumbent"],
  ["就職", "しゅうしょく", "finding employment; getting a job"],
  ["職業", "しょくぎょう", "occupation; profession; job"],
  ["職場", "しょくば", "one's post; place of work; workplace"],
];

export const SAMPLE_CARD: KanjiCardAi = {
  meaningKo: "직업, 일",
  words: [
    { written: "就職", reading: "しゅうしょく", meaningKo: "취직" },
    { written: "職場", reading: "しょくば", meaningKo: "직장" },
  ],
  example: { ja: "{来年|らいねん}、IT{企業|きぎょう}に{就職|しゅうしょく}したい。", ko: "내년에 IT 기업에 취직하고 싶다." },
};

export const SAMPLE_RESPONSE: KanjiCardResponse = {
  card: SAMPLE_CARD,
  status: "auto_verified",
  verification: {
    promptVersion: "v2",
    dataVersion: "kanjidic2-2026-11-09+unihan-18.0.0+jmdict-2026-11-10",
    model: "claude-haiku-5-5",
    judgeModel: "claude-haiku-5-5",
    judge: { meaning: 5, words: 5, translation: 5 },
    attempts: 1,
    generatedAt: "2026-11-11T00:00:00.000Z",
  },
};
