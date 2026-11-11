// AI ↔ 화면 후리가나 규약: {漢字|かんじ} → ruby. 규약은 .claude/skills/jp-tutor-prompt 참고.
// 닫히지 않은 "{…"는 패턴에 안 걸려서 그대로 글자로 남는다 (서버 검증이 중괄호 짝을 본다)

export type FuriganaToken =
  | { type: "text"; text: string }
  | { type: "ruby"; base: string; reading: string };

const RUBY = /\{([^|{}]+)\|([^{}]+)\}/g;

export function parseFurigana(source: string): FuriganaToken[] {
  const tokens: FuriganaToken[] = [];
  let last = 0;
  for (const m of source.matchAll(RUBY)) {
    if (m.index > last) tokens.push({ type: "text", text: source.slice(last, m.index) });
    tokens.push({ type: "ruby", base: m[1], reading: m[2] });
    last = m.index + m[0].length;
  }
  if (last < source.length) tokens.push({ type: "text", text: source.slice(last) });
  return tokens;
}

// {学校|がっこう}に行く → 学校に行く
export const plainText = (source: string) =>
  parseFurigana(source)
    .map((t) => (t.type === "ruby" ? t.base : t.text))
    .join("");

export const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const isKana = (c: string) => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(c);

// 단어 표기·읽기(JMdict) → 루비 토큰. 앞뒤 가나가 읽기와 같으면 루비 밖으로 뺀다: 楽しい/たのしい → {楽|たの}しい, お話/おはなし → お{話|はなし}
export function wordFurigana(written: string, reading: string): FuriganaToken[] {
  const w = [...written];
  const r = [...reading];
  let head = 0;
  while (head < w.length - 1 && isKana(w[head]) && toHiragana(w[head]) === toHiragana(r[head] ?? "")) head++;
  let tail = 0;
  while (
    tail < w.length - head - 1 &&
    isKana(w[w.length - 1 - tail]) &&
    toHiragana(w[w.length - 1 - tail]) === toHiragana(r[r.length - 1 - tail] ?? "")
  ) {
    tail++;
  }
  const base = w.slice(head, w.length - tail).join("");
  const rubyReading = r.slice(head, r.length - tail).join("");
  // 가운데가 모두 가나면(읽기와 표기가 같은 말) 루비를 달지 않는다
  if (!rubyReading || [...base].every(isKana)) return [{ type: "text", text: written }];
  return [
    ...(head > 0 ? [{ type: "text" as const, text: w.slice(0, head).join("") }] : []),
    { type: "ruby", base, reading: rubyReading },
    ...(tail > 0 ? [{ type: "text" as const, text: w.slice(w.length - tail).join("") }] : []),
  ];
}
