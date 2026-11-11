// npm run eval:kanji -- --n 30 --runs 2 [--concurrency 3] [--sample <결과.json>] [--record] [--rescore <결과.json>]
// 표본 n자 × runs회 카드를 /api/kanji와 같은 파이프라인(생성 → 검증 → 판정 → 재생성, src/lib/cards/generate.ts)으로 만들고(저장 안 함),
// 화면에 보이는 카드에 결정적 검사 + 판정 모델 채점 + 시간을 잰다. 검증에 떨어져 화면에 안 나오는 카드(rejected)는 실패로 센다.
// 결과 evals/results/, 실패 사례 evals/failures/. --record면 docs/ACCURACY.md "eval 기록"에 한 줄을 더한다.
// 규칙·기준: .claude/skills/ai-eval · evals/README.md
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { generateText, Output } from "ai";
import { z } from "zod";
import { anthropicProvider, cardJudgeModelId, cardModelId } from "../src/lib/ai/kanji-generate";
import { KANJI_PROMPT_VERSION } from "../src/lib/ai/prompts";
import { createKanjiCard } from "../src/lib/cards/generate";
import type { KanjiCardAi } from "../src/lib/cards/schema";
import { parseCardV1 } from "../src/lib/eval/card-v1";
import { renderCardText } from "../src/lib/eval/card-v2";
import {
  cardPasses,
  INFO_CHECKS,
  jmdictIndex,
  percentile,
  REQUIRED_CHECKS,
  runChecks,
  type CheckResult,
  type KoForm,
  type Truth,
} from "../src/lib/eval/checks";
import { appendEvalRow, evalDate, redactError, resultName, spreadSample } from "../src/lib/eval/report";
import type { WordCandidate } from "../src/lib/kanji/build-data";
import type { KanjiEntry, KanjiFile } from "../src/lib/kanji/data";
import type { WordsFile } from "../src/lib/kanji/words";

const ROOT = join(import.meta.dirname, "..");
const EVALS = join(ROOT, "evals");
const CACHE_DIR = join(EVALS, ".cache");
const ACCURACY = join(ROOT, "docs", "ACCURACY.md");
const ACCURACY_HEADING = "### eval 기록 (ai-eval이 추가)";

// 응답 없는 요청에 실행 전체가 멈추지 않게 (첫 시험 실행에서 한 번 멈췄다). 시간 초과는 생성 오류로 센다.
// 생성·검증 판정·재생성을 모두 합친 상한 — /api/kanji의 PIPELINE_TIMEOUT_MS와 같게
const GENERATE_TIMEOUT_MS = 30_000;
const JUDGE_TIMEOUT_MS = 120_000;
// 판정을 못 받은 카드가 이보다 많으면 판정 평균을 믿을 수 없어 실패로 끝낸다
const MIN_JUDGED_SHARE = 0.9;

// 판정 모델은 생성 모델(Haiku)과 다른 모델로 둔다 (ai-eval 스킬). 학교 API에서 못 쓰면 ANTHROPIC_JUDGE_MODEL로 바꾼다.
// Opus 5.5는 temperature를 받지 않아(400) 판정 점수에 실행마다 흔들림이 있다 — 판끼리 0.1 안팎 차이는 잡음으로 본다
const DEFAULT_JUDGE_MODEL = "claude-opus-5-5";
// 비용 추정용 1M 토큰당 달러 (Anthropic 공개 가격, claude-api 스킬 2026-10 표). 학교 API 청구와 다를 수 있다
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

type WordEntry = { variants: { written: string; pronounced: string }[]; meanings: { glosses: string[] }[] };

const JUDGE_DIMENSIONS = ["meaning", "words", "example", "translation"] as const;
type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];
// 점수 범위(1~5 정수)는 받은 뒤 검사한다 — 범위 밖이면 판정 오류로 센다
const Score = z.object({ score: z.number(), reason: z.string() });
const JudgeSchema = z.object({ meaning: Score, words: Score, example: Score, translation: Score });
type Judgement = z.infer<typeof JudgeSchema>;

const JUDGE_INSTRUCTIONS = `너는 한국인 일본어 학습자(JLPT N3~N2)용 한자 카드를 채점하는 검수자다.
주어진 사전 사실을 기준으로 카드의 네 항목을 각각 1~5점(정수)으로 채점하고, 한 줄 이유를 한국어로 쓴다.
5 = 정확하고 자연스럽다 · 4 = 사소한 흠 · 3 = 쓸 만하지만 고칠 점이 있다 · 2 = 틀린 부분이 있다 · 1 = 틀렸거나 없다
- meaning: "뜻"의 한국어가 사전의 영어 뜻과 맞는가
- words: "자주 쓰는 단어"의 한국어 뜻이 JMdict 영어 뜻과 맞고, 일상·취업 맥락에서 실제로 자주 쓰는 단어인가
- example: 예문이 자연스러운 현대 표준 일본어인가
- translation: 예문의 한국어 번역이 일본어 문장과 같은 뜻인가
읽기·후리가나·한국 자형 차이는 코드로 따로 검사하므로 점수에 넣지 않는다.`;

type CardResult = {
  char: string;
  run: number;
  // 화면에 보이는 카드를 v1 라벨 형식으로 그린 것 (v1 결과는 모델 원문). 미노출 카드는 빈 문자열
  text: string;
  // v2: 모델이 낸 AI 부분 · 시도 횟수 · 시도마다 검증에 떨어진 사유
  card?: KanjiCardAi;
  attempts?: number;
  failures?: string[][];
  // v2: 두 번 다 검증에 떨어져 화면에 나오지 않음 (사유)
  rejected?: string;
  error?: string;
  latencyMs: number;
  // 생성 토큰 / 검증 판정(규칙 5) 토큰 — 판정 모델 채점(judgeTokens)과 따로
  tokens: { input: number; output: number };
  cardJudgeTokens?: { input: number; output: number };
  checks: CheckResult[];
  pass: boolean;
  // JMdict를 받지 못해 words를 판정하지 못함 → 통과율이 부풀므로 실행을 실패로 끝낸다
  jmdictMissing?: boolean;
  judge: Judgement | null;
  judgeError?: string;
  judgeTokens: { input: number; output: number };
};

type Meta = {
  date: string;
  promptVersion: string;
  model: string;
  // v2: 카드 검증 규칙 5의 판정 모델 (eval 채점용 judgeModel과 따로)
  cardJudgeModel?: string;
  judgeModel: string;
  n: number;
  runs: number;
  // 실제로 쓴 글자 (정답 셋이 늘어도 같은 표본으로 다시 돌릴 수 있게: --sample)
  sample: string[];
};

type SavedRun = Meta & {
  truth: string;
  dataVersion: string;
  rescoredAt?: string;
  rescoreDataVersion?: string;
  results: CardResult[];
};

function loadLocalEnv() {
  // 로컬 실행은 .env.local의 키를 쓴다 (CI는 시크릿을 환경 변수로 받는다). 이미 있는 환경 변수는 덮어쓰지 않는다
  const file = join(ROOT, ".env.local");
  if (existsSync(file)) loadEnvFile(file);
}

async function wordsOf(char: string): Promise<WordEntry[] | null> {
  const file = join(CACHE_DIR, `words-U+${char.codePointAt(0)!.toString(16).toUpperCase()}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as WordEntry[];
  try {
    const res = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(char)}`);
    if (!res.ok) throw new Error(`kanjiapi.dev ${res.status}`);
    const entries = (await res.json()) as WordEntry[];
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(entries));
    return entries;
  } catch (error) {
    console.warn(`JMdict 단어를 받지 못함 (${char}): ${redactError(error)}`);
    return null;
  }
}

function glossesFor(entries: WordEntry[] | null, written: string[]): string {
  if (!entries) return "(JMdict를 받지 못함)";
  return written
    .map((w) => {
      const entry = entries.find((e) => e.variants.some((v) => v.written === w));
      return entry ? `${w}: ${entry.meanings.flatMap((m) => m.glosses).slice(0, 6).join("; ")}` : `${w}: (JMdict에 없음)`;
    })
    .join("\n");
}

// 카드 원문으로 결정적 검사를 한다. --rescore는 이것만 다시 해서 API 없이 숫자를 갱신한다
function score(result: CardResult, truth: Truth, ko: KoForm | null, entries: WordEntry[] | null) {
  result.jmdictMissing = entries === null;
  // v2에서 화면에 안 나온 카드는 검사할 카드가 없다 — 검사별 분모에서 빼고 통과율에서만 실패로 센다
  if (result.rejected) {
    result.checks = [];
    result.pass = false;
    return;
  }
  result.checks = runChecks(result.text, parseCardV1(result.text), truth, ko, entries ? jmdictIndex(entries) : null);
  // v2: 단어 후보가 없는 글자는 단어 없이 나온다 (words.json, ACCURACY 4장)
  if (result.card && result.card.words.length === 0) {
    result.checks = result.checks.map((c) => (c.name === "words" ? { name: "words", pass: null, detail: "단어 후보 없음" } : c));
  }
  result.pass = !result.error && cardPasses(result.checks);
}

async function evaluate(
  truth: Truth,
  ko: KoForm | null,
  entry: KanjiEntry,
  candidates: WordCandidate[],
  lookup: (char: string) => KanjiEntry | null,
  run: number,
  judgeModel: string,
): Promise<CardResult> {
  const provider = anthropicProvider();
  const result: CardResult = {
    char: truth.literal,
    run,
    text: "",
    latencyMs: 0,
    tokens: { input: 0, output: 0 },
    checks: [],
    pass: false,
    judge: null,
    judgeTokens: { input: 0, output: 0 },
  };

  const started = performance.now();
  try {
    const made = await createKanjiCard(truth.literal, entry, candidates, { abortSignal: AbortSignal.timeout(GENERATE_TIMEOUT_MS), lookup });
    result.tokens = made.usage.generation;
    result.cardJudgeTokens = made.usage.judge;
    result.attempts = made.attempts;
    result.failures = made.failures;
    if (made.status === "rejected") {
      result.rejected = made.failures.map((f) => f.join(" / ")).join(" → ");
    } else {
      result.card = made.card;
      result.text = renderCardText(entry, made.card);
    }
  } catch (error) {
    result.error = redactError(error);
  }
  // 실패·시간 초과도 걸린 시간 그대로 p95에 넣는다 (빼면 느린 실패가 숫자를 좋아 보이게 한다)
  result.latencyMs = Math.round(performance.now() - started);

  const entries = await wordsOf(truth.literal);
  score(result, truth, ko, entries);
  if (result.error || !result.text) return result;

  try {
    const judged = await generateText({
      model: provider(judgeModel),
      instructions: JUDGE_INSTRUCTIONS,
      prompt: [
        `한자: ${truth.literal}`,
        `사전 영어 뜻(KANJIDIC2): ${truth.meanings_en.join(", ")}`,
        `카드 단어의 JMdict 영어 뜻:\n${glossesFor(entries, parseCardV1(result.text).words.map((w) => w.written))}`,
        `카드:\n<card>\n${result.text}\n</card>`,
      ].join("\n\n"),
      output: Output.object({ schema: JudgeSchema }),
      maxOutputTokens: 8000,
      abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
    });
    result.judgeTokens = { input: judged.usage.inputTokens ?? 0, output: judged.usage.outputTokens ?? 0 };
    const scores = JUDGE_DIMENSIONS.map((d) => judged.output[d].score);
    if (scores.some((s) => !Number.isInteger(s) || s < 1 || s > 5)) throw new Error(`점수 범위 밖: ${scores.join(",")}`);
    result.judge = judged.output;
  } catch (error) {
    result.judgeError = redactError(error);
  }
  return result;
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await work(items[i]);
        process.stdout.write(`\r${++done}/${items.length}`);
      }
    }),
  );
  process.stdout.write("\n");
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const cost = (model: string, t: { input: number; output: number }) => {
  const price = PRICE_PER_MTOK[model];
  return price ? (t.input * price.input + t.output * price.output) / 1e6 : null;
};
const sumTokens = (ts: { input: number; output: number }[]) =>
  ts.reduce((a, t) => ({ input: a.input + t.input, output: a.output + t.output }), { input: 0, output: 0 });

function summarize(results: CardResult[]) {
  const checks = Object.fromEntries(
    [...REQUIRED_CHECKS, ...INFO_CHECKS].map((name) => {
      const all = results.flatMap((r) => r.checks.filter((c) => c.name === name));
      const scored = all.filter((c) => c.pass !== null);
      // unscored: 데이터가 없어 판정하지 않은 카드 (분모에서 빠진다)
      return [name, { pass: scored.filter((c) => c.pass).length, total: scored.length, unscored: all.length - scored.length }];
    }),
  );
  const judged = results.filter((r) => r.judge);
  const judge = Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d, mean(judged.map((r) => r.judge![d].score))])) as Record<
    JudgeDimension,
    number
  >;
  const allScores = judged.flatMap((r) => JUDGE_DIMENSIONS.map((d) => r.judge![d].score));
  const latencies = results.map((r) => r.latencyMs);
  return {
    cards: results.length,
    passed: results.filter((r) => r.pass).length,
    errors: results.filter((r) => r.error).length,
    // v2: 검증에 두 번 떨어져 화면에 안 나온 카드 · 재생성으로 통과한 카드
    rejected: results.filter((r) => r.rejected).length,
    retried: results.filter((r) => !r.rejected && (r.attempts ?? 1) > 1).length,
    jmdictMissing: results.filter((r) => r.jmdictMissing).length,
    checks,
    judge: {
      ...judge,
      mean: mean(JUDGE_DIMENSIONS.map((d) => judge[d])),
      judged: judged.length,
      judgeErrors: results.filter((r) => r.judgeError).length,
      // 평균은 천장(5점)에 몰려 차이가 잘 안 보인다 — 3점 이하 비율을 같이 본다
      lowShare: allScores.length ? allScores.filter((s) => s <= 3).length / allScores.length : NaN,
    },
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    tokens: sumTokens(results.map((r) => r.tokens)),
    cardJudgeTokens: sumTokens(results.map((r) => r.cardJudgeTokens ?? { input: 0, output: 0 })),
    judgeTokens: sumTokens(results.map((r) => r.judgeTokens)),
  };
}

function failuresMarkdown(title: string, results: CardResult[]): string {
  const failed = results.filter((r) => !r.pass || r.judgeError || (r.judge && JUDGE_DIMENSIONS.some((d) => r.judge![d].score <= 3)));
  const blocks = failed.map((r) => {
    const reasons = [
      ...(r.error ? [`- 생성 오류: ${r.error}`] : []),
      ...(r.rejected ? [`- 검증 탈락(미노출, ${r.attempts}회 시도): ${r.rejected}`] : []),
      ...(!r.rejected && r.failures?.length ? [`- (참고) 재생성 전 검증 사유: ${r.failures.flat().join(" / ")}`] : []),
      ...r.checks.filter((c) => c.pass === false).map((c) => `- ${c.name}: ${c.detail ?? "실패"}`),
      ...(r.judgeError ? [`- 판정 오류: ${r.judgeError}`] : []),
      ...(r.judge
        ? JUDGE_DIMENSIONS.filter((d) => r.judge![d].score <= 3).map((d) => `- 판정 ${d} ${r.judge![d].score}점: ${r.judge![d].reason}`)
        : []),
    ];
    return `## ${r.char} (run ${r.run})\n${reasons.join("\n")}\n\n\`\`\`\n${r.text || "(빈 응답)"}\n\`\`\``;
  });
  return `# ${title}\n\n결정적 검사 실패(참고 검사 포함) · 판정 3점 이하 · 오류가 있는 카드 ${failed.length}장\n\n${blocks.join("\n\n")}\n`;
}

const TABLE_HEADER =
  "| 날짜 | 프롬프트 | 모델 | 판정 모델 | 표본 | 결정적 통과율 | 검사별 통과 | 판정 평균 (항목별 · 3점 이하) | p50 / p95 ms |\n|---|---|---|---|---|---|---|---|---|";

function summaryRow(meta: Meta, s: ReturnType<typeof summarize>) {
  const checks = Object.entries(s.checks)
    .map(([name, c]) => `${name} ${c.pass}/${c.total}`)
    .join(" · ");
  const judge = JUDGE_DIMENSIONS.map((d) => `${d} ${s.judge[d].toFixed(2)}`).join(" · ");
  const model = meta.cardJudgeModel ? `${meta.model} (검증 판정 ${meta.cardJudgeModel})` : meta.model;
  const rejected = meta.cardJudgeModel ? ` · 미노출 ${s.rejected} · 재생성 ${s.retried}` : "";
  return `| ${meta.date} | ${meta.promptVersion} | ${model} | ${meta.judgeModel} | ${meta.n}자 × ${meta.runs}회 | ${pct(s.passed / s.cards)} (${s.passed}/${s.cards}${rejected}) | ${checks} | ${s.judge.mean.toFixed(2)} (${judge} · ≤3점 ${pct(s.judge.lowShare)}) | ${s.latencyMs.p50} / ${s.latencyMs.p95} |`;
}

function readSaved(path: string): SavedRun {
  const saved = JSON.parse(readFileSync(path, "utf8")) as SavedRun;
  // 표본을 남기기 전 결과 파일은 결과의 글자 순서로 복원한다
  saved.sample ??= [...new Set(saved.results.map((r) => r.char))];
  return saved;
}

async function main() {
  const { values } = parseArgs({
    options: {
      n: { type: "string", default: "30" },
      runs: { type: "string", default: "2" },
      concurrency: { type: "string", default: "3" },
      // 저장된 결과 파일과 같은 글자로 돌린다 (판끼리 비교할 때: 정답 셋이 늘어도 표본이 그대로)
      sample: { type: "string" },
      record: { type: "boolean", default: false },
      // 저장된 결과 파일의 카드 원문으로 결정적 검사만 다시 한다. 판정 점수·시간·데이터 판은 그대로 둔다
      rescore: { type: "string" },
    },
  });

  const truthFile = JSON.parse(readFileSync(join(EVALS, "kanji-truth.json"), "utf8")) as { source: string; characters: Truth[] };
  const kanji = JSON.parse(readFileSync(join(ROOT, "src", "data", "kanji.json"), "utf8")) as KanjiFile;
  // 카드 생성의 입력(단어 후보). words 검사의 정답(kanjiapi.dev JMdict, wordsOf)과는 따로다
  const words = JSON.parse(readFileSync(join(ROOT, "src", "data", "words.json"), "utf8")) as WordsFile;
  const dataVersion = `${kanji.dataVersion}+${words.dataVersion}`;
  const truthOf = (char: string) => {
    const t = truthFile.characters.find((c) => c.literal === char);
    if (!t) throw new Error(`정답 셋에 없는 글자: ${char}`);
    return t;
  };
  const koOf = (char: string) => kanji.kanji[char]?.ko ?? null;
  const entryOf = (char: string) => {
    const e = kanji.kanji[char];
    if (!e) throw new Error(`kanji.json에 없는 글자(상용한자 아님): ${char}`);
    return e;
  };

  let run: SavedRun;
  if (values.rescore) {
    run = readSaved(values.rescore);
    for (const r of run.results) score(r, truthOf(r.char), koOf(r.char), await wordsOf(r.char));
    run.rescoredAt = new Date().toISOString();
    run.rescoreDataVersion = dataVersion;
    console.log(`eval:kanji 다시 채점: ${values.rescore} (생성 당시 데이터 ${run.dataVersion}, 지금 ${dataVersion})`);
  } else {
    loadLocalEnv();
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 없습니다 (.env.local 또는 환경 변수)");
    const base = values.sample ? readSaved(values.sample) : null;
    const chars = base ? base.sample.map(truthOf) : spreadSample(truthFile.characters, Number(values.n));
    const runs = base ? base.runs : Number(values.runs);
    const meta: Meta = {
      date: evalDate(),
      promptVersion: KANJI_PROMPT_VERSION,
      model: cardModelId(),
      cardJudgeModel: cardJudgeModelId(),
      judgeModel: process.env.ANTHROPIC_JUDGE_MODEL || DEFAULT_JUDGE_MODEL,
      n: chars.length,
      runs,
      sample: chars.map((c) => c.literal),
    };
    console.log(
      `eval:kanji ${meta.promptVersion} · ${meta.model} (검증 판정 ${meta.cardJudgeModel}) · 채점 ${meta.judgeModel} · ${meta.n}자 × ${meta.runs}회`,
    );
    console.log(`표본: ${meta.sample.join("")}${base ? ` (${values.sample}와 같은 표본)` : ""}`);
    const jobs = chars.flatMap((truth) => Array.from({ length: runs }, (_, i) => ({ truth, run: i + 1 })));
    const results = await pool(jobs, Number(values.concurrency), ({ truth, run: i }) =>
      evaluate(truth, koOf(truth.literal), entryOf(truth.literal), words.words[truth.literal] ?? [], (c) => kanji.kanji[c] ?? null, i, meta.judgeModel),
    );
    run = { ...meta, truth: truthFile.source, dataVersion, results };
  }

  const summary = summarize(run.results);
  // 생성 비용 = 카드 생성 + 검증 판정(규칙 5) — 사용자 요청마다 드는 돈
  const cardJudgeCost = run.cardJudgeModel ? cost(run.cardJudgeModel, summary.cardJudgeTokens) : 0;
  const generationCost = cost(run.model, summary.tokens) !== null && cardJudgeCost !== null ? cost(run.model, summary.tokens)! + cardJudgeCost : null;
  const judgeCost = cost(run.judgeModel, summary.judgeTokens);
  const name = resultName(run);
  mkdirSync(join(EVALS, "results"), { recursive: true });
  mkdirSync(join(EVALS, "failures"), { recursive: true });
  const { results, ...meta } = run;
  writeFileSync(
    join(EVALS, "results", `${name}.json`),
    `${JSON.stringify({ ...meta, summary, costUsd: { generation: generationCost, judge: judgeCost }, results }, null, 2)}\n`,
  );
  writeFileSync(join(EVALS, "failures", `${name}.md`), failuresMarkdown(`eval:kanji 실패 사례 — ${name}`, results));

  const row = summaryRow(run, summary);
  const report = [
    `결정적 통과율 ${pct(summary.passed / summary.cards)} (${summary.passed}/${summary.cards}, 생성 오류 ${summary.errors} · 검증 탈락 미노출 ${summary.rejected} · 재생성으로 통과 ${summary.retried})`,
    ...Object.entries(summary.checks).map(
      ([k, c]) => `  ${k}${(INFO_CHECKS as readonly string[]).includes(k) ? " (참고)" : ""}: ${c.pass}/${c.total}${c.unscored ? ` · 판정 안 함 ${c.unscored}` : ""}`,
    ),
    `판정 평균 ${summary.judge.mean.toFixed(2)} (${summary.judge.judged}장, 판정 오류 ${summary.judge.judgeErrors}) — ${JUDGE_DIMENSIONS.map((d) => `${d} ${summary.judge[d].toFixed(2)}`).join(" · ")} · 3점 이하 ${pct(summary.judge.lowShare)}`,
    `시간 p50 ${summary.latencyMs.p50}ms · p95 ${summary.latencyMs.p95}ms (스트리밍 아님 · 동시 ${values.concurrency} · 실패 포함)`,
    `토큰 생성 ${summary.tokens.input}/${summary.tokens.output} · 검증 판정 ${summary.cardJudgeTokens.input}/${summary.cardJudgeTokens.output} · 채점 ${summary.judgeTokens.input}/${summary.judgeTokens.output} (입력/출력)`,
    `추정 비용 생성(검증 판정 포함) $${generationCost?.toFixed(4) ?? "?"} · 채점 $${judgeCost?.toFixed(4) ?? "?"}`,
    `결과 evals/results/${name}.json · 실패 사례 evals/failures/${name}.md`,
  ].join("\n");
  console.log(report);

  // CI(eval.yml)에서는 작업 요약에도 남긴다
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## eval:kanji\n\n${TABLE_HEADER}\n${row}\n\n\`\`\`\n${report}\n\`\`\`\n`);
  }

  // 숫자를 믿을 수 없는 실행은 실패로 끝내고 ACCURACY에도 남기지 않는다
  const generated = summary.cards - summary.errors;
  // 채점 대상 = 화면에 나온 카드 (검증 탈락 카드는 채점하지 않는다)
  const shown = generated - summary.rejected;
  const problems = [
    ...(generated === 0 ? ["모든 생성이 실패했습니다 — 키·주소·모델을 확인하세요"] : []),
    ...(summary.jmdictMissing > 0 ? [`JMdict를 받지 못한 카드 ${summary.jmdictMissing}장 — words를 판정하지 못해 통과율이 부풉니다`] : []),
    ...(shown > 0 && summary.judge.judged < shown * MIN_JUDGED_SHARE
      ? [`판정을 받은 카드가 ${summary.judge.judged}/${shown}장뿐입니다 (판정 오류 ${summary.judge.judgeErrors})`]
      : []),
  ];
  if (problems.length > 0) throw new Error(`이번 실행의 숫자는 쓸 수 없습니다:\n- ${problems.join("\n- ")}`);

  if (values.record) {
    writeFileSync(ACCURACY, appendEvalRow(readFileSync(ACCURACY, "utf8"), ACCURACY_HEADING, TABLE_HEADER, row));
    console.log("docs/ACCURACY.md eval 기록에 추가했습니다");
  }
}

main().catch((e) => {
  console.error(redactError(e instanceof Error ? e.message : e));
  process.exit(1);
});
