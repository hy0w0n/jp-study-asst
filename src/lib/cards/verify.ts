// 카드 v2 서버 검증 — 저장·노출 전에 반드시 통과해야 한다 (docs/ACCURACY.md 2장의 6규칙, card-pipeline 스킬).
// 규칙 1~4·6은 코드로(verifyCard), 규칙 5는 판정 모델 점수로(judgeRule) 본다. 떨어진 사유는 재생성 프롬프트에 그대로 붙는다
import { parseFurigana, plainText, toHiragana } from "../ai/furigana";
import { wordCount } from "../ai/prompts";
import type { WordCandidate } from "../kanji/build-data";
import { JUDGE_DIMENSIONS, KanjiCardAiSchema, type CardJudgement, type KanjiCardAi } from "./schema";

export type RuleName = "schema" | "words" | "furigana" | "example" | "judge" | "forbidden";
export type RuleResult = { rule: RuleName; pass: boolean; detail?: string };
export type VerifyContext = { char: string; candidates: WordCandidate[] };

// 글자 수 상한 (프롬프트는 더 짧게 요구한다 — 조금 넘는 것까지 버리지는 않는다)
const LIMITS = { meaningKo: 20, wordMeaningKo: 20, exampleJa: 40, exampleKo: 80 };
// 판정 점수가 이보다 낮은 항목이 있으면 버린다 (ACCURACY 2장: 뜻 판정 ≥ 3/5)
export const JUDGE_MIN = 3;

const HAN = /\p{Script=Han}/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const HANGUL = /\p{Script=Hangul}/u;
// 읽기·자형은 사전 데이터의 몫이다 — AI가 한국어 칸에서 판단하면 사전 섹션과 어긋날 수 있다 (해커톤: 職 "간체 职과 다름")
const FORBIDDEN = /음독|훈독|자형|신자체|구자체|번체|간체|한국 한자|일본 한자/;

const len = (s: string) => [...s].length;
const result = (rule: RuleName, problems: string[]): RuleResult =>
  problems.length > 0 ? { rule, pass: false, detail: problems.join(" / ") } : { rule, pass: true };

function trimCard(card: KanjiCardAi): KanjiCardAi {
  return {
    meaningKo: card.meaningKo.trim(),
    words: card.words.map((w) => ({ written: w.written.trim(), reading: w.reading.trim(), meaningKo: w.meaningKo.trim() })),
    example: { ja: card.example.ja.trim(), ko: card.example.ko.trim() },
  };
}

// 규칙 1: 모양 + 길이·개수
function checkSchema(card: KanjiCardAi, ctx: VerifyContext): RuleResult {
  const problems: string[] = [];
  const n = wordCount(ctx.candidates);
  const texts = [card.meaningKo, card.example.ja, card.example.ko, ...card.words.flatMap((w) => Object.values(w))];
  if (texts.some((t) => t.includes("\n"))) problems.push("모든 칸은 한 줄");
  if (!card.meaningKo || len(card.meaningKo) > LIMITS.meaningKo) problems.push(`meaningKo는 1~${LIMITS.meaningKo}자`);
  if (card.words.length !== n) problems.push(`words는 정확히 ${n}개 (지금 ${card.words.length}개)`);
  for (const w of card.words) {
    if (!w.written || !w.reading) problems.push("단어의 written·reading이 비었음");
    if (!w.meaningKo || len(w.meaningKo) > LIMITS.wordMeaningKo) problems.push(`「${w.written}」의 meaningKo는 1~${LIMITS.wordMeaningKo}자`);
  }
  if (!card.example.ja || len(plainText(card.example.ja)) > LIMITS.exampleJa) problems.push(`example.ja는 1~${LIMITS.exampleJa}자`);
  if (!card.example.ko || len(card.example.ko) > LIMITS.exampleKo) problems.push(`example.ko는 1~${LIMITS.exampleKo}자`);
  return result("schema", problems);
}

// 규칙 2: 단어가 후보(JMdict)에 표기·읽기 그대로 있고 겹치지 않는다
function checkWords(card: KanjiCardAi, ctx: VerifyContext): RuleResult {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const w of card.words) {
    const found = ctx.candidates.find(([written]) => written === w.written);
    if (!found) problems.push(`「${w.written}」은 [단어 후보]에 없음`);
    else if (found[1] !== w.reading) problems.push(`「${w.written}」의 읽기는 ${found[1]} (지금 ${w.reading})`);
    if (seen.has(w.written)) problems.push(`「${w.written}」이 두 번 나옴`);
    seen.add(w.written);
  }
  return result("words", problems);
}

// 규칙 3: 예문의 한자는 모두 {漢字|かな}, 읽기는 가나만, 중괄호 짝. 후보 단어(두 글자 이상)를 통째로 묶었으면 읽기가 후보와 같아야 한다.
// 한 글자 묶음은 비교하지 않는다 — {楽|たの}しい의 楽는 후보 단어 楽(らく)가 아니다
function checkFurigana(card: KanjiCardAi, ctx: VerifyContext): RuleResult {
  const problems: string[] = [];
  for (const token of parseFurigana(card.example.ja)) {
    if (token.type === "ruby") {
      if (!KANA_ONLY.test(token.reading)) problems.push(`{${token.base}|${token.reading}}: 읽기는 가나만`);
      const word = len(token.base) > 1 ? ctx.candidates.find(([written]) => written === token.base) : undefined;
      if (word && toHiragana(word[1]) !== toHiragana(token.reading)) {
        problems.push(`{${token.base}|${token.reading}}: 사전 읽기는 ${word[1]}`);
      }
    } else if (HAN.test(token.text)) {
      problems.push(`후리가나 없는 한자: ${[...token.text].filter((c) => HAN.test(c)).join("")}`);
    } else if (/[{}|]/.test(token.text)) {
      problems.push("중괄호 짝이 맞지 않음");
    }
  }
  return result("furigana", problems);
}

// 규칙 4: 예문에 이 한자가 들어 있다
function checkExample(card: KanjiCardAi, ctx: VerifyContext): RuleResult {
  return result("example", plainText(card.example.ja).includes(ctx.char) ? [] : [`예문에 ${ctx.char}가 없음`]);
}

// 규칙 6: 한국어 칸에 가나·읽기·자형 판단이 없고, 일본어 예문에 한글이 없다
function checkForbidden(card: KanjiCardAi): RuleResult {
  const problems: string[] = [];
  for (const text of [card.meaningKo, ...card.words.map((w) => w.meaningKo), card.example.ko]) {
    if (KANA.test(text)) problems.push(`한국어 칸에 가나: "${text}"`);
    if (FORBIDDEN.test(text)) problems.push(`한국어 칸에 읽기·자형 이야기: "${text}"`);
  }
  if (HANGUL.test(card.example.ja)) problems.push("일본어 예문에 한글");
  return result("forbidden", problems);
}

// 규칙 1~4·6. 모양부터 틀리면(JSON이 아니거나 필드가 없음) 나머지는 보지 않는다
export function verifyCard(raw: unknown, ctx: VerifyContext): { card: KanjiCardAi | null; results: RuleResult[] } {
  const parsed = KanjiCardAiSchema.safeParse(raw);
  if (!parsed.success) return { card: null, results: [{ rule: "schema", pass: false, detail: "JSON 스키마와 맞지 않음" }] };
  const card = trimCard(parsed.data);
  return {
    card,
    results: [checkSchema(card, ctx), checkWords(card, ctx), checkFurigana(card, ctx), checkExample(card, ctx), checkForbidden(card)],
  };
}

// 규칙 5: 판정 모델의 세 항목이 모두 JUDGE_MIN 이상 (점수는 1~5 정수여야 한다)
export function judgeRule(judgement: CardJudgement): RuleResult {
  const problems: string[] = [];
  for (const d of JUDGE_DIMENSIONS) {
    const { score, reason } = judgement[d];
    if (!Number.isInteger(score) || score < 1 || score > 5) problems.push(`${d} 점수 범위 밖: ${score}`);
    else if (score < JUDGE_MIN) problems.push(`${d} ${score}점: ${reason}`);
  }
  return result("judge", problems);
}

export const passed = (results: RuleResult[]) => results.every((r) => r.pass);

// 재생성 프롬프트·로그용 사유 목록
export const problemsOf = (results: RuleResult[]) => results.filter((r) => !r.pass).map((r) => `${r.rule}: ${r.detail}`);
