import { describe, expect, it, vi } from "vitest";
import { SAMPLE_CARD, SHOKU_CANDIDATES } from "./__fixtures__/kanji-card";
import { runCardPipeline, type GenerateFn, type JudgeFn } from "./generate";
import type { CardJudgement } from "./schema";

const ctx = { char: "職", candidates: SHOKU_CANDIDATES };
const usage = { input: 100, output: 50 };
const score = (n: number): CardJudgement => ({
  meaning: { score: n, reason: "뜻" },
  words: { score: 5, reason: "단어" },
  translation: { score: 5, reason: "번역" },
});
const BAD = { ...SAMPLE_CARD, example: { ja: "{会社|かいしゃ}に{行|い}く。", ko: "회사에 간다." } };

// 시도마다 다른 답을 내는 가짜 생성기
const generator = (...raws: unknown[]) => vi.fn<GenerateFn>(async () => ({ raw: raws.shift(), usage }));
const judger = (...scores: number[]) => vi.fn<JudgeFn>(async () => ({ judgement: score(scores.shift() ?? 5), usage }));

describe("runCardPipeline", () => {
  it("첫 시도가 통과하면 바로 돌려준다", async () => {
    const generate = generator(SAMPLE_CARD);
    const result = await runCardPipeline(ctx, generate, judger(5));
    expect(result).toMatchObject({ status: "auto_verified", card: SAMPLE_CARD, attempts: 1, failures: [] });
    expect(result.usage).toEqual({ generation: usage, judge: usage });
    expect(generate).toHaveBeenCalledWith([]);
  });

  it("검증에 떨어지면 사유를 붙여 한 번 다시 만든다", async () => {
    const generate = generator(BAD, SAMPLE_CARD);
    const judge = judger(5);
    const result = await runCardPipeline(ctx, generate, judge);
    expect(result).toMatchObject({ status: "auto_verified", attempts: 2, failures: [["example: 예문에 職가 없음"]] });
    expect(generate).toHaveBeenLastCalledWith(["example: 예문에 職가 없음"]);
    // 결정적 검증에 떨어진 답은 판정 모델에 보내지 않는다
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("판정에 떨어져도 다시 만든다", async () => {
    const generate = generator(SAMPLE_CARD, SAMPLE_CARD);
    const result = await runCardPipeline(ctx, generate, judger(2, 4));
    expect(result).toMatchObject({ status: "auto_verified", attempts: 2, failures: [["judge: meaning 2점: 뜻"]] });
    expect(result.usage.judge).toEqual({ input: 200, output: 100 });
  });

  it("판정 응답이 깨지면(null) 그 시도는 실패로 세고 다시 만든다", async () => {
    const generate = generator(SAMPLE_CARD, SAMPLE_CARD);
    const judge = vi
      .fn<JudgeFn>()
      .mockResolvedValueOnce({ judgement: null, usage })
      .mockResolvedValueOnce({ judgement: score(5), usage });
    const result = await runCardPipeline(ctx, generate, judge);
    expect(result).toMatchObject({ status: "auto_verified", attempts: 2, failures: [["judge: 판정 응답을 읽지 못함"]] });
  });

  it("두 번 다 떨어지면 rejected — 화면에 보이지 않는다", async () => {
    const generate = generator(null, BAD);
    const result = await runCardPipeline(ctx, generate, judger());
    expect(result.status).toBe("rejected");
    expect(result.attempts).toBe(2);
    expect(result.failures).toEqual([["schema: JSON 스키마와 맞지 않음"], ["example: 예문에 職가 없음"]]);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("모델 호출 오류는 그대로 던진다 (/api/kanji가 AI 오류로 답한다)", async () => {
    const generate = vi.fn<GenerateFn>(async () => {
      throw new Error("Cannot connect to API");
    });
    await expect(runCardPipeline(ctx, generate, judger())).rejects.toThrow("Cannot connect to API");
  });
});
