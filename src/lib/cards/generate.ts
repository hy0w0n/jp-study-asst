// 카드 v2 생성 파이프라인: 생성 → 결정적 검증(규칙 1~4·6) → 판정(규칙 5) → 떨어지면 사유를 붙여 1회 재생성 → 그래도 떨어지면 rejected.
// /api/kanji와 eval(scripts/eval-kanji.ts)이 같이 쓴다. 사전 데이터는 인자로 받는다 — kanji.json·words.json 모듈은
// server-only라 eval(tsx)에서 읽을 수 없어서 부르는 쪽이 읽어 넘긴다. 규약: .claude/skills/card-pipeline
import { generateText, NoObjectGeneratedError, Output, type LanguageModelUsage } from "ai";
import { anthropicProvider, cardJudgeModelId, cardJudgeRequest, cardModelId, kanjiCardRequest } from "../ai/kanji-generate";
import type { WordCandidate } from "../kanji/build-data";
import type { KanjiEntry } from "../kanji/data";
import { CardJudgementSchema, KanjiCardAiSchema, type CardJudgement, type KanjiCardAi } from "./schema";
import { judgeRule, passed, problemsOf, verifyCard, type VerifyContext } from "./verify";

export type Usage = { input: number; output: number };
// feedback: 앞 시도가 떨어진 사유 (첫 시도는 빈 배열). raw: 모델이 낸 객체, 스키마에 맞지 않는 JSON이면 null
export type GenerateFn = (feedback: string[]) => Promise<{ raw: unknown; usage: Usage }>;
// judgement: 판정 모델이 스키마에 맞지 않는 JSON(잘림 포함)을 내면 null → 그 시도는 실패로 세고 다시 만든다
export type JudgeFn = (card: KanjiCardAi) => Promise<{ judgement: CardJudgement | null; usage: Usage }>;

export const MAX_ATTEMPTS = 2;

export type PipelineResult = {
  attempts: number;
  usage: { generation: Usage; judge: Usage };
  // 시도마다 떨어진 사유 (통과한 시도는 없음). 서버 로그·eval 실패 사례용
  failures: string[][];
} & ({ status: "auto_verified"; card: KanjiCardAi; judgement: CardJudgement } | { status: "rejected" });

const add = (a: Usage, b: Usage) => ({ input: a.input + b.input, output: a.output + b.output });

// 생성·판정 함수를 받아 순서만 정한다 (단위 테스트는 가짜 함수로). 네트워크·API 오류는 그대로 던진다 → /api/kanji가 502
export async function runCardPipeline(ctx: VerifyContext, generate: GenerateFn, judge: JudgeFn): Promise<PipelineResult> {
  const usage = { generation: { input: 0, output: 0 }, judge: { input: 0, output: 0 } };
  const failures: string[][] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const generated = await generate(failures.at(-1) ?? []);
    usage.generation = add(usage.generation, generated.usage);
    const { card, results } = verifyCard(generated.raw, ctx);
    if (!card || !passed(results)) {
      failures.push(problemsOf(results));
      continue;
    }
    const judged = await judge(card);
    usage.judge = add(usage.judge, judged.usage);
    if (!judged.judgement) {
      failures.push(["judge: 판정 응답을 읽지 못함"]);
      continue;
    }
    const rule = judgeRule(judged.judgement);
    if (!rule.pass) {
      failures.push(problemsOf([rule]));
      continue;
    }
    return { status: "auto_verified", card, judgement: judged.judgement, attempts: attempt, usage, failures };
  }
  return { status: "rejected", attempts: MAX_ATTEMPTS, usage, failures };
}

const usageOf = (u: LanguageModelUsage | undefined): Usage => ({ input: u?.inputTokens ?? 0, output: u?.outputTokens ?? 0 });

// 실제 모델(Anthropic, kanji-generate.ts 설정)로 파이프라인을 돌린다. lookup: 예문 한자 읽기 대조용 사전 조회 (VerifyContext)
export async function createKanjiCard(
  char: string,
  entry: KanjiEntry,
  candidates: WordCandidate[],
  { abortSignal, lookup }: { abortSignal?: AbortSignal; lookup?: VerifyContext["lookup"] } = {},
): Promise<PipelineResult & { model: string; judgeModel: string }> {
  const provider = anthropicProvider();
  const ctx = { char, candidates, lookup };

  const generate: GenerateFn = async (feedback) => {
    const req = kanjiCardRequest(char, entry, candidates, feedback);
    try {
      const res = await generateText({
        model: provider(req.modelId),
        instructions: req.instructions,
        prompt: req.prompt,
        maxOutputTokens: req.maxOutputTokens,
        providerOptions: req.providerOptions,
        output: Output.object({ schema: KanjiCardAiSchema }),
        abortSignal,
      });
      return { raw: res.output, usage: usageOf(res.usage) };
    } catch (error) {
      // 스키마에 맞지 않는 JSON(잘림 포함)은 검증 규칙 1 실패로 보고 재생성한다. 그 밖의 오류는 위로
      if (NoObjectGeneratedError.isInstance(error)) return { raw: null, usage: usageOf(error.usage) };
      throw error;
    }
  };

  const judge: JudgeFn = async (card) => {
    const req = cardJudgeRequest(char, entry, candidates, card);
    try {
      const res = await generateText({
        model: provider(req.modelId),
        instructions: req.instructions,
        prompt: req.prompt,
        maxOutputTokens: req.maxOutputTokens,
        providerOptions: req.providerOptions,
        output: Output.object({ schema: CardJudgementSchema }),
        abortSignal,
      });
      return { judgement: res.output, usage: usageOf(res.usage) };
    } catch (error) {
      // 생성과 같게: 깨진 판정 응답은 그 시도의 실패로 센다 (이미 규칙 1~4·6을 통과한 카드를 502로 버리지 않게)
      if (NoObjectGeneratedError.isInstance(error)) return { judgement: null, usage: usageOf(error.usage) };
      throw error;
    }
  };

  const result = await runCardPipeline(ctx, generate, judge);
  return { ...result, model: cardModelId(), judgeModel: cardJudgeModelId() };
}
