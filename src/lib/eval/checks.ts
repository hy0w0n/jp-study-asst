// eval:kanji의 결정적 검사 — 정답이 있는 것만 코드로 본다 (.claude/skills/ai-eval). 판정 모델 채점은 scripts/eval-kanji.ts
import { isCompleteCard } from "../ai/kanji-card";
import { parseFurigana } from "../ai/furigana";
import type { CardV1 } from "./card-v1";

// evals/kanji-truth.json의 한 글자 (KANJIDIC2)
export type Truth = { literal: string; on: string[]; kun: string[]; meanings_en: string[] };
// kanji.json의 한국 자형 (Unihan) — kanji-truth.json에는 없다
export type KoForm = { forms: string[]; diff: "same" | "form" | "none" };
// JMdict 표기 → 읽기(히라가나) 모음. kanjiapi.dev /v1/words/{字}에서 만든다
export type Jmdict = Map<string, Set<string>>;

// pass: null은 데이터가 없어 판정하지 않음 (통과율 분모에서 뺀다)
export type CheckResult = { name: CheckName; pass: boolean | null; detail?: string };

// 결정적 통과율에 들어가는 검사. 참고 검사는 통과율에 넣지 않고 따로 센다:
// example-has-char(v1 프롬프트가 요구하지 않음), kun-notation(훈독 기호 표기 — 읽기는 kun이 따로 본다)
export const REQUIRED_CHECKS = ["format", "on", "kun", "ko-diff", "furigana", "words"] as const;
export const INFO_CHECKS = ["example-has-char", "kun-notation"] as const;
export type CheckName = (typeof REQUIRED_CHECKS)[number] | (typeof INFO_CHECKS)[number];

const HAN = /\p{Script=Han}/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

export const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 훈독을 기호 없는 사전형으로: KANJIDIC2 まな.ぶ · -こ.む · あお-, 카드의 うご-く · つか(える) → まなぶ · こむ · あお · うごく · つかえる
// (카드의 기호 표기는 프롬프트 위반이지만 읽기 자체는 맞다 — 여기서는 읽기만 잰다)
const plainKun = (k: string) => toHiragana(k).replace(/[.\-()（）]/g, "");

export function checkFormat(text: string): CheckResult {
  return { name: "format", pass: isCompleteCard(text), detail: isCompleteCard(text) ? undefined : "라벨 누락 또는 잘림" };
}

export function checkOn(card: CardV1, truth: Truth): CheckResult {
  const wrong = card.on.filter((r) => !truth.on.includes(r));
  if (wrong.length > 0) return { name: "on", pass: false, detail: `사전에 없는 음독: ${wrong.join("、")}` };
  if (truth.on.length > 0 && card.on.length === 0) return { name: "on", pass: false, detail: "음독 빠짐" };
  return { name: "on", pass: true };
}

// 훈독은 프롬프트가 "상용 읽기 1~2개, 확실하지 않으면 -"를 요구한다 — 고른 읽기가 사전에 있는지만 본다
export function checkKun(card: CardV1, truth: Truth): CheckResult {
  const dictionary = new Set(truth.kun.map(plainKun));
  const wrong = card.kun.filter((r) => !dictionary.has(plainKun(r)));
  return wrong.length > 0
    ? { name: "kun", pass: false, detail: `사전에 없는 훈독: ${wrong.join("、")}` }
    : { name: "kun", pass: true };
}

// "한국 한자와 차이" 줄이 Unihan 데이터와 맞는지. 한국 자형이 없으면 판정하지 않는다
// - 자형이 다르면: 한국 자형을 하나라도 말하고, "같음"으로 시작하지 않아야 한다 ("같음 (歷 → 歴)"은 학습자가 같다고 읽는다)
// - 같으면: "같음/동일/同じ"라고 하거나, 다른 한자를 내놓지 않아야 한다 (뜻 차이 설명은 허용)
const SAME = /같음|같은|동일|同じ/;
export function checkKoDiff(card: CardV1, char: string, ko: KoForm | null): CheckResult {
  const line = card.koDiff ?? "";
  if (!ko || ko.diff === "none") return { name: "ko-diff", pass: null, detail: "한국 자형 데이터 없음" };
  if (ko.diff === "form") {
    if (line.startsWith("같음")) return { name: "ko-diff", pass: false, detail: `한국은 ${ko.forms.join("·")}인데 "같음": "${line}"` };
    return ko.forms.some((f) => line.includes(f))
      ? { name: "ko-diff", pass: true }
      : { name: "ko-diff", pass: false, detail: `한국 자형 ${ko.forms.join("·")}을 말하지 않음: "${line}"` };
  }
  const others = [...line].filter((c) => HAN.test(c) && c !== char);
  return SAME.test(line) || others.length === 0
    ? { name: "ko-diff", pass: true }
    : { name: "ko-diff", pass: false, detail: `같은 글자인데 다른 자형을 제시: "${line}"` };
}

// 단어·예문의 한자는 모두 {漢字|かな}여야 하고, 읽기는 가나만, 중괄호는 짝이 맞아야 한다
export function checkFurigana(card: CardV1): CheckResult {
  const sources = [...card.words.map((w) => w.source), card.example?.source ?? ""];
  const problems: string[] = [];
  for (const source of sources) {
    for (const token of parseFurigana(source)) {
      if (token.type === "ruby") {
        if (!KANA_ONLY.test(token.reading)) problems.push(`읽기가 가나가 아님: {${token.base}|${token.reading}}`);
      } else if (HAN.test(token.text)) {
        problems.push(`후리가나 없는 한자: ${[...token.text].filter((c) => HAN.test(c)).join("")}`);
      } else if (/[{}|]/.test(token.text)) {
        problems.push(`중괄호 짝이 안 맞음: ${source}`);
      }
    }
  }
  return problems.length > 0 ? { name: "furigana", pass: false, detail: problems.join(" / ") } : { name: "furigana", pass: true };
}

// 단어가 이 한자를 포함하고, JMdict에 그 표기·읽기로 있는지
export function checkWords(card: CardV1, char: string, jmdict: Jmdict | null): CheckResult {
  if (!card.hasWords) return { name: "words", pass: null, detail: "단어 절을 찾지 못함 (format에서 실패로 센다)" };
  if (card.words.length === 0) return { name: "words", pass: false, detail: "단어 없음" };
  if (!jmdict) return { name: "words", pass: null, detail: "JMdict를 받지 못함" };
  const problems: string[] = [];
  for (const w of card.words) {
    if (!w.written.includes(char)) problems.push(`${w.written}: ${char} 없음`);
    else if (!jmdict.has(w.written)) problems.push(`${w.written}: JMdict에 없음`);
    else if (!jmdict.get(w.written)!.has(toHiragana(w.reading))) {
      problems.push(`${w.written}: 읽기 ${w.reading} ≠ JMdict ${[...jmdict.get(w.written)!].join("・")}`);
    }
  }
  return problems.length > 0 ? { name: "words", pass: false, detail: problems.join(" / ") } : { name: "words", pass: true };
}

// 프롬프트는 훈독을 기호 없는 사전형(まなぶ)으로 쓰게 한다. うご-く · つか(える)는 화면에 그대로 보인다
export function checkKunNotation(card: CardV1): CheckResult {
  const marked = card.kun.filter((r) => /[.\-()（）]/.test(r));
  return marked.length > 0
    ? { name: "kun-notation", pass: false, detail: `훈독에 기호: ${marked.join("、")}` }
    : { name: "kun-notation", pass: true };
}

export function checkExampleHasChar(card: CardV1, char: string): CheckResult {
  const pass = card.example?.ja.includes(char) ?? false;
  return { name: "example-has-char", pass, detail: pass ? undefined : "예문에 이 한자가 없음" };
}

// kanjiapi.dev /v1/words/{字} 응답 → 표기별 읽기
export function jmdictIndex(entries: { variants: { written: string; pronounced: string }[] }[]): Jmdict {
  const index: Jmdict = new Map();
  for (const entry of entries) {
    for (const v of entry.variants) {
      if (!index.has(v.written)) index.set(v.written, new Set());
      index.get(v.written)!.add(toHiragana(v.pronounced));
    }
  }
  return index;
}

export function runChecks(text: string, card: CardV1, truth: Truth, ko: KoForm | null, jmdict: Jmdict | null): CheckResult[] {
  return [
    checkFormat(text),
    checkOn(card, truth),
    checkKun(card, truth),
    checkKoDiff(card, truth.literal, ko),
    checkFurigana(card),
    checkWords(card, truth.literal, jmdict),
    checkExampleHasChar(card, truth.literal),
    checkKunNotation(card),
  ];
}

// 필수 검사가 모두 통과(판정 불가 null은 제외)해야 카드 통과
export const cardPasses = (results: CheckResult[]) =>
  results.every((r) => !(REQUIRED_CHECKS as readonly string[]).includes(r.name) || r.pass !== false);

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
