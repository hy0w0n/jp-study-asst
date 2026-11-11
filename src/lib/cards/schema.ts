// 한자 카드 v2의 AI 부분(뜻·단어·예문)과 /api/kanji 응답 모양. 규약: .claude/skills/card-pipeline · jp-tutor-prompt
// 생성 스키마는 모양(타입)만 정해 모델에 보낸다. 길이·개수·후보 일치 같은 엄격한 검사는 verify.ts가 한다 —
// 스키마에 넣으면 어긋난 답이 예외로 끝나서 사유를 붙인 재생성(검증 규칙 → 1회 재시도)을 못 한다
import { z } from "zod";

export const KanjiCardAiSchema = z.object({
  meaningKo: z.string().describe("한자의 한국어 뜻, 12자 이내"),
  words: z
    .array(
      z.object({
        written: z.string().describe("[단어 후보]의 표기 그대로"),
        reading: z.string().describe("[단어 후보]의 읽기 그대로"),
        meaningKo: z.string().describe("단어의 한국어 뜻, 짧게"),
      }),
    )
    .describe("[단어 후보]에서 고른 단어"),
  example: z.object({
    ja: z.string().describe("{漢字|よみ} 후리가나를 붙인 일본어 예문 한 문장"),
    ko: z.string().describe("예문의 한국어 번역"),
  }),
});

export type KanjiCardAi = z.infer<typeof KanjiCardAiSchema>;

// 판정 모델 점수 (검증 규칙 5). 범위(1~5 정수)는 받은 뒤 verify.ts가 본다
const Score = z.object({ score: z.number(), reason: z.string() });
export const CardJudgementSchema = z.object({ meaning: Score, words: Score, translation: Score });
export type CardJudgement = z.infer<typeof CardJudgementSchema>;

export const JUDGE_DIMENSIONS = ["meaning", "words", "translation"] as const;

// 카드와 함께 남기는 검증 기록 (card-pipeline: 저장할 때 카드 옆에 둔다)
export type Verification = {
  promptVersion: string;
  dataVersion: string;
  model: string;
  judgeModel: string;
  judge: Record<(typeof JUDGE_DIMENSIONS)[number], number>;
  attempts: number;
  generatedAt: string;
};

// 화면에는 자동 검증을 통과한 카드만 간다. 사람 검수(verified)·저장은 #14·#15
export type KanjiCardResponse = { card: KanjiCardAi; status: "auto_verified"; verification: Verification };

// 오류 종류별로 화면 문구가 다르다 (AGENTS 절대 규칙 4: 네트워크·AI·데이터 실패를 구분)
export type CardErrorKind = "input" | "no-data" | "rate-limit" | "config" | "ai" | "verify";
export type CardErrorResponse = { error: string; kind: CardErrorKind };
