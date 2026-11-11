// kanji 모드 v1 카드(마크다운 텍스트)를 eval이 검사할 수 있는 모양으로 나눈다. v1 형식은 화면에서 내렸고(#13),
// 기준선 결과 재채점(--rescore)과, v2 카드를 같은 잣대로 재는 데(card-v2.ts가 화면의 카드를 이 형식으로 그린다)만 쓴다
import { parseFurigana } from "../ai/furigana";

// 라벨을 모두 갖추고 마지막 줄(예문 → 번역)까지 끝난 카드인지 (eval의 format 검사)
const REQUIRED = [
  /^\*\*음독\*\*.*\*\*훈독\*\*/m,
  /^\*\*뜻\*\*:/m,
  /^\*\*한국 한자와 차이\*\*:/m,
  /^\*\*자주 쓰는 단어\*\*:/m,
  /^\*\*예문\*\*:[^\n]*→\s*\S/m,
];

export const isCompleteCard = (text: string) => REQUIRED.every((re) => re.test(text));

export type CardWord = { source: string; written: string; reading: string; gloss: string };

export type CardV1 = {
  on: string[];
  kun: string[];
  meaningKo: string | null;
  koDiff: string | null;
  // 단어 절이 있었는지 (없으면 형식 문제라 words 검사는 판정하지 않는다)
  hasWords: boolean;
  words: CardWord[];
  example: { source: string; ja: string; ko: string } | null;
};

// "-"·"(-)"·"なし"·"없음"은 읽기가 없다는 표시 (프롬프트가 훈독이 없거나 확실하지 않으면 「-」를 쓰게 한다)
const NONE = new Set(["", "-", "－", "(-)", "「-」", "なし", "없음"]);

function readings(value: string): string[] {
  return value
    .split(/[、,，・·/\s]+/)
    .map((r) => r.trim())
    .filter((r) => !NONE.has(r));
}

function labeled(text: string, label: string): string | null {
  const m = text.match(new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

// {職業|しょくぎょう} → 표기 職業 · 읽기 しょくぎょう. 루비 밖 글자는 표기·읽기에 그대로 붙인다(오쿠리가나)
export function furiganaWord(source: string): { written: string; reading: string } {
  const tokens = parseFurigana(source);
  return {
    written: tokens.map((t) => (t.type === "ruby" ? t.base : t.text)).join(""),
    reading: tokens.map((t) => (t.type === "ruby" ? t.reading : t.text)).join(""),
  };
}

// 읽기는 형식이 조금 틀려도(음독·훈독을 다른 줄에, 音読 라벨, 콜론) 읽어 낸다 — 형식은 format 검사가 따로 보고,
// on·kun 검사는 읽기가 맞는지만 재게 한다. 값은 다음 " · **" 또는 줄 끝까지
function readingAfter(text: string, labels: string): string | null {
  const m = text.match(new RegExp(`\\*\\*(?:${labels})\\*\\*\\s*:?\\s*([^\\n]*?)(?=\\s*·\\s*\\*\\*|\\s*$)`, "m"));
  return m ? m[1] : null;
}

export function parseCardV1(text: string): CardV1 {
  const on = readingAfter(text, "음독|音読み?");
  const kun = readingAfter(text, "훈독|訓読み?");

  // "**자주 쓰는 단어**:" 다음의 "- " 줄들 (다음 굵은 라벨 전까지). 라벨이 일본어(よく使う単語)여도 읽는다 — 형식은 format이 본다
  const words: CardWord[] = [];
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^\*\*[^*]*(단어|単語)\*\*:/.test(l.trim()));
  if (start >= 0) {
    for (const line of lines.slice(start + 1)) {
      const t = line.trim();
      if (t.startsWith("**")) break;
      if (!t.startsWith("- ")) continue;
      const [source, ...gloss] = t.slice(2).split(/\s+[—–-]\s+/);
      words.push({ source: source.trim(), ...furiganaWord(source.trim()), gloss: gloss.join(" - ").trim() });
    }
  }

  const exampleLine = labeled(text, "(?:예문|例文)");
  const arrow = exampleLine?.indexOf("→") ?? -1;
  const example =
    exampleLine && arrow >= 0
      ? {
          source: exampleLine.slice(0, arrow).trim(),
          ja: furiganaWord(exampleLine.slice(0, arrow).trim()).written,
          ko: exampleLine.slice(arrow + 1).trim(),
        }
      : null;

  return {
    on: on === null ? [] : readings(on),
    kun: kun === null ? [] : readings(kun),
    meaningKo: labeled(text, "뜻"),
    koDiff: labeled(text, "한국 한자와 차이"),
    hasWords: start >= 0,
    words,
    example,
  };
}
