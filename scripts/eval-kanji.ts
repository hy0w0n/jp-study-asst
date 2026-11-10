// npm run eval:kanji -- --n 30 --runs 2 [--concurrency 3] [--record]
// 표본 n자 × runs회 카드를 /api/kanji와 같은 설정으로 만들고(저장 안 함), 결정적 검사 + 판정 모델 채점 + 시간을 잰다.
// 결과 evals/results/, 실패 사례 evals/failures/. --record면 docs/ACCURACY.md "eval 기록"에 한 줄을 더한다.
// 규칙·기준: .claude/skills/ai-eval · evals/README.md
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";
import { generateText, Output } from "ai";
import { z } from "zod";
import { anthropicProvider, kanjiCardRequest } from "../src/lib/ai/kanji-generate";
import { KANJI_PROMPT_VERSION } from "../src/lib/ai/prompts";
import { parseCardV1 } from "../src/lib/eval/card-v1";
import {
  cardPasses,
  jmdictIndex,
  percentile,
  REQUIRED_CHECKS,
  runChecks,
  type CheckResult,
  type KoForm,
  type Truth,
} from "../src/lib/eval/checks";
import type { KanjiFile } from "../src/lib/kanji/data";

const ROOT = join(import.meta.dirname, "..");
const EVALS = join(ROOT, "evals");
const CACHE_DIR = join(EVALS, ".cache");
const ACCURACY = join(ROOT, "docs", "ACCURACY.md");

// 응답 없는 요청에 실행 전체가 멈추지 않게 (첫 시험 실행에서 한 번 멈췄다). 시간 초과는 생성 오류로 센다
const GENERATE_TIMEOUT_MS = 30_000;
const JUDGE_TIMEOUT_MS = 120_000;

// 판정 모델은 생성 모델(Haiku)과 다른 모델로 둔다 (ai-eval 스킬). 학교 API에서 못 쓰면 ANTHROPIC_JUDGE_MODEL로 바꾼다
const DEFAULT_JUDGE_MODEL = "claude-opus-5-5";
// 비용 추정용 1M 토큰당 달러 (Anthropic 공개 가격, 2026-10 기준). 학교 API 청구와 다를 수 있다
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

type WordEntry = { variants: { written: string; pronounced: string }[]; meanings: { glosses: string[] }[] };

const JUDGE_DIMENSIONS = ["meaning", "words", "example", "translation"] as const;
type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];
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
  text: string;
  error?: string;
  latencyMs: number;
  tokens: { input: number; output: number };
  checks: CheckResult[];
  pass: boolean;
  judge: Judgement | null;
  judgeError?: string;
  judgeTokens: { input: number; output: number };
};

function loadLocalEnv() {
  // 로컬 실행은 .env.local의 키를 쓴다 (CI는 시크릿을 환경 변수로 받는다)
  const file = join(ROOT, ".env.local");
  if (existsSync(file)) loadEnvFile(file);
}

// 표본은 정답 셋 전체에 고르게 퍼지게 고정한다 (실행마다 같은 글자 → 판끼리 비교할 수 있다)
function sample<T>(items: T[], n: number): T[] {
  if (n >= items.length) return items;
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)]);
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
    console.warn(`JMdict 단어를 받지 못함 (${char}): ${error}`);
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

// 저장된 카드 원문으로 결정적 검사만 다시 한다 (--rescore: 검사 규칙을 고친 뒤 API를 다시 부르지 않고 숫자를 갱신)
async function rescore(result: CardResult, truth: Truth, ko: KoForm | null) {
  const entries = await wordsOf(truth.literal);
  result.checks = runChecks(result.text, parseCardV1(result.text), truth, ko, entries ? jmdictIndex(entries) : null);
  result.pass = !result.error && cardPasses(result.checks);
}

async function evaluate(truth: Truth, ko: KoForm | null, run: number, judgeModel: string): Promise<CardResult> {
  const provider = anthropicProvider();
  const request = kanjiCardRequest(truth.literal);
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
    const generated = await generateText({
      model: provider(request.modelId),
      instructions: request.instructions,
      prompt: request.prompt,
      maxOutputTokens: request.maxOutputTokens,
      providerOptions: request.providerOptions,
      abortSignal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    result.text = generated.text;
    result.tokens = { input: generated.usage.inputTokens ?? 0, output: generated.usage.outputTokens ?? 0 };
  } catch (error) {
    result.error = String(error);
  }
  result.latencyMs = Math.round(performance.now() - started);

  const card = parseCardV1(result.text);
  const entries = await wordsOf(truth.literal);
  await rescore(result, truth, ko);
  if (result.error || !result.text) return result;

  try {
    const judged = await generateText({
      model: provider(judgeModel),
      instructions: JUDGE_INSTRUCTIONS,
      prompt: [
        `한자: ${truth.literal}`,
        `사전 영어 뜻(KANJIDIC2): ${truth.meanings_en.join(", ")}`,
        `카드 단어의 JMdict 영어 뜻:\n${glossesFor(entries, card.words.map((w) => w.written))}`,
        `카드:\n<card>\n${result.text}\n</card>`,
      ].join("\n\n"),
      output: Output.object({ schema: JudgeSchema }),
      maxOutputTokens: 8000,
      abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
    });
    const scores = JUDGE_DIMENSIONS.map((d) => judged.output[d].score);
    if (scores.some((s) => !Number.isInteger(s) || s < 1 || s > 5)) throw new Error(`점수 범위 밖: ${scores.join(",")}`);
    result.judge = judged.output;
    result.judgeTokens = { input: judged.usage.inputTokens ?? 0, output: judged.usage.outputTokens ?? 0 };
  } catch (error) {
    result.judgeError = String(error);
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
  const checkNames = [...REQUIRED_CHECKS, "example-has-char"] as const;
  const checks = Object.fromEntries(
    checkNames.map((name) => {
      const judged = results.flatMap((r) => r.checks.filter((c) => c.name === name && c.pass !== null));
      return [name, { pass: judged.filter((c) => c.pass).length, total: judged.length }];
    }),
  );
  const judged = results.filter((r) => r.judge);
  const judge = Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d, mean(judged.map((r) => r.judge![d].score))])) as Record<
    JudgeDimension,
    number
  >;
  const latencies = results.filter((r) => !r.error).map((r) => r.latencyMs);
  return {
    cards: results.length,
    passed: results.filter((r) => r.pass).length,
    errors: results.filter((r) => r.error).length,
    checks,
    judge: { ...judge, mean: mean(JUDGE_DIMENSIONS.map((d) => judge[d])), judged: judged.length },
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    tokens: sumTokens(results.map((r) => r.tokens)),
    judgeTokens: sumTokens(results.map((r) => r.judgeTokens)),
  };
}

function failuresMarkdown(title: string, results: CardResult[]): string {
  const failed = results.filter((r) => !r.pass || r.judgeError || (r.judge && JUDGE_DIMENSIONS.some((d) => r.judge![d].score <= 3)));
  const blocks = failed.map((r) => {
    const reasons = [
      ...(r.error ? [`- 생성 오류: ${r.error}`] : []),
      ...r.checks.filter((c) => c.pass === false).map((c) => `- ${c.name}: ${c.detail ?? "실패"}`),
      ...(r.judgeError ? [`- 판정 오류: ${r.judgeError}`] : []),
      ...(r.judge
        ? JUDGE_DIMENSIONS.filter((d) => r.judge![d].score <= 3).map((d) => `- 판정 ${d} ${r.judge![d].score}점: ${r.judge![d].reason}`)
        : []),
    ];
    return `## ${r.char} (run ${r.run})\n${reasons.join("\n")}\n\n\`\`\`\n${r.text || "(빈 응답)"}\n\`\`\``;
  });
  return `# ${title}\n\n결정적 검사 실패 · 판정 3점 이하 · 오류가 있는 카드 ${failed.length}장\n\n${blocks.join("\n\n")}\n`;
}

function summaryRow(meta: { date: string; promptVersion: string; model: string; judgeModel: string; n: number; runs: number }, s: ReturnType<typeof summarize>) {
  const checks = Object.entries(s.checks)
    .map(([name, c]) => `${name} ${c.pass}/${c.total}`)
    .join(" · ");
  const judge = JUDGE_DIMENSIONS.map((d) => `${d} ${s.judge[d].toFixed(2)}`).join(" · ");
  return `| ${meta.date} | ${meta.promptVersion} | ${meta.model} | ${meta.judgeModel} | ${meta.n}자 × ${meta.runs}회 | ${pct(s.passed / s.cards)} (${s.passed}/${s.cards}) | ${checks} | ${s.judge.mean.toFixed(2)} (${judge}) | ${s.latencyMs.p50} / ${s.latencyMs.p95} |`;
}

const TABLE_HEADER =
  "| 날짜 | 프롬프트 | 모델 | 판정 모델 | 표본 | 결정적 통과율 | 검사별 통과 | 판정 평균 (항목별) | p50 / p95 ms |\n|---|---|---|---|---|---|---|---|---|";

// ACCURACY.md 맨 끝 "eval 기록" 절에 한 줄을 더한다 (처음이면 "(없음)"을 표 머리로 바꾼다)
function recordToAccuracy(row: string) {
  let doc = readFileSync(ACCURACY, "utf8");
  const heading = "### eval 기록 (ai-eval이 추가)";
  if (!doc.includes(heading)) throw new Error(`${ACCURACY}에 "${heading}" 절이 없습니다`);
  const [head, tail] = doc.split(heading);
  const body = tail.includes("(없음)") ? tail.replace("(없음)", TABLE_HEADER) : tail;
  doc = `${head}${heading}${body.trimEnd()}\n${row}\n`;
  writeFileSync(ACCURACY, doc);
}

type Meta = { date: string; promptVersion: string; model: string; judgeModel: string; n: number; runs: number };

async function main() {
  const { values } = parseArgs({
    options: {
      n: { type: "string", default: "30" },
      runs: { type: "string", default: "2" },
      concurrency: { type: "string", default: "3" },
      record: { type: "boolean", default: false },
      // 저장된 결과 파일(evals/results/*.json)의 카드 원문으로 결정적 검사만 다시 한다. 판정 점수·시간은 그대로 둔다
      rescore: { type: "string" },
    },
  });

  const truthFile = JSON.parse(readFileSync(join(EVALS, "kanji-truth.json"), "utf8")) as { source: string; characters: Truth[] };
  const kanji = JSON.parse(readFileSync(join(ROOT, "src", "data", "kanji.json"), "utf8")) as KanjiFile;
  const koOf = (char: string) => kanji.kanji[char]?.ko ?? null;

  let meta: Meta;
  let results: CardResult[];
  if (values.rescore) {
    const saved = JSON.parse(readFileSync(values.rescore, "utf8")) as Meta & { results: CardResult[] };
    meta = { date: saved.date, promptVersion: saved.promptVersion, model: saved.model, judgeModel: saved.judgeModel, n: saved.n, runs: saved.runs };
    results = saved.results;
    for (const r of results) await rescore(r, truthFile.characters.find((t) => t.literal === r.char)!, koOf(r.char));
    console.log(`eval:kanji 다시 채점: ${values.rescore}`);
  } else {
    loadLocalEnv();
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 없습니다 (.env.local 또는 환경 변수)");
    meta = {
      date: new Date().toLocaleDateString("sv-SE"),
      promptVersion: KANJI_PROMPT_VERSION,
      model: kanjiCardRequest("一").modelId,
      judgeModel: process.env.ANTHROPIC_JUDGE_MODEL || DEFAULT_JUDGE_MODEL,
      n: Number(values.n),
      runs: Number(values.runs),
    };
    const chars = sample(truthFile.characters, meta.n);
    console.log(`eval:kanji ${meta.promptVersion} · ${meta.model} · 판정 ${meta.judgeModel} · ${chars.length}자 × ${meta.runs}회`);
    console.log(`표본: ${chars.map((c) => c.literal).join("")}`);
    const jobs = chars.flatMap((truth) => Array.from({ length: meta.runs }, (_, run) => ({ truth, run: run + 1 })));
    results = await pool(jobs, Number(values.concurrency), ({ truth, run }) =>
      evaluate(truth, koOf(truth.literal), run, meta.judgeModel),
    );
  }

  const { date, model, judgeModel } = meta;
  const summary = summarize(results);
  const generationCost = cost(model, summary.tokens);
  const judgeCost = cost(judgeModel, summary.judgeTokens);
  const name = `${date}-${meta.promptVersion}-${model}`;
  mkdirSync(join(EVALS, "results"), { recursive: true });
  mkdirSync(join(EVALS, "failures"), { recursive: true });
  writeFileSync(
    join(EVALS, "results", `${name}.json`),
    `${JSON.stringify({ ...meta, truth: truthFile.source, dataVersion: kanji.dataVersion, summary, costUsd: { generation: generationCost, judge: judgeCost }, results }, null, 2)}\n`,
  );
  writeFileSync(join(EVALS, "failures", `${name}.md`), failuresMarkdown(`eval:kanji 실패 사례 — ${name}`, results));

  const row = summaryRow(meta, summary);
  const report = [
    `결정적 통과율 ${pct(summary.passed / summary.cards)} (${summary.passed}/${summary.cards}, 생성 오류 ${summary.errors})`,
    ...Object.entries(summary.checks).map(([k, c]) => `  ${k}: ${c.pass}/${c.total}`),
    `판정 평균 ${summary.judge.mean.toFixed(2)} (${summary.judge.judged}장) — ${JUDGE_DIMENSIONS.map((d) => `${d} ${summary.judge[d].toFixed(2)}`).join(" · ")}`,
    `시간 p50 ${summary.latencyMs.p50}ms · p95 ${summary.latencyMs.p95}ms`,
    `토큰 생성 ${summary.tokens.input}/${summary.tokens.output} · 판정 ${summary.judgeTokens.input}/${summary.judgeTokens.output} (입력/출력)`,
    `추정 비용 생성 $${generationCost?.toFixed(4) ?? "?"} · 판정 $${judgeCost?.toFixed(4) ?? "?"}`,
    `결과 evals/results/${name}.json · 실패 사례 evals/failures/${name}.md`,
  ].join("\n");
  console.log(report);

  if (values.record) {
    recordToAccuracy(row);
    console.log("docs/ACCURACY.md eval 기록에 추가했습니다");
  }
  // CI(eval.yml)에서는 작업 요약에도 남긴다
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## eval:kanji\n\n${TABLE_HEADER}\n${row}\n\n\`\`\`\n${report}\n\`\`\`\n`);
  }
  if (summary.errors === summary.cards) throw new Error("모든 생성이 실패했습니다 — 키·주소·모델을 확인하세요");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
