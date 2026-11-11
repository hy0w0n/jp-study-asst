// v2 카드를 eval이 v1과 같은 잣대로 재게 한다: 화면에 보이는 카드(사전 사실 + AI 부분)를 v1 라벨 텍스트로 그려
// 같은 결정적 검사(checks.ts)·판정 루브릭(scripts/eval-kanji.ts)을 그대로 쓴다. 읽기·한국 자형 줄은 사전 데이터에서 온다
import { wordFurigana } from "../ai/furigana";
import type { KanjiCardAi } from "../cards/schema";
import type { KanjiEntry } from "../kanji/data";

function koDiffLine(ko: KanjiEntry["ko"]): string {
  switch (ko.diff) {
    case "same":
      return "같음";
    case "form":
      return `다름 — 한국 ${ko.forms.join("·")}`;
    case "none":
      return "한국 자형 없음";
  }
}

// 단어는 단어 루비 그대로 {楽|たの}しい — 화면(KanjiExplain)과 같은 모양
const wordSource = (written: string, reading: string) =>
  wordFurigana(written, reading)
    .map((t) => (t.type === "ruby" ? `{${t.base}|${t.reading}}` : t.text))
    .join("");

export function renderCardText(entry: KanjiEntry, card: KanjiCardAi): string {
  return [
    `**음독** ${entry.on.join("、") || "-"} · **훈독** ${entry.kun.map((k) => k.reading).join("、") || "-"}`,
    `**뜻**: ${card.meaningKo}`,
    `**한국 한자와 차이**: ${koDiffLine(entry.ko)}`,
    "**자주 쓰는 단어**:",
    ...card.words.map((w) => `- ${wordSource(w.written, w.reading)} — ${w.meaningKo}`),
    `**예문**: ${card.example.ja} → ${card.example.ko}`,
  ].join("\n");
}
