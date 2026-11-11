// 한자 카드 생성·판정 설정. /api/kanji와 eval(scripts/eval-kanji.ts)이 같은 설정을 쓰게 한 곳에 둔다 — eval이 화면과 다른 걸 재면 숫자가 의미 없다.
// 키·주소는 서버 환경 변수에서만 읽는다. 호출 순서(생성 → 검증 → 판정 → 재생성)는 src/lib/cards/generate.ts
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { WordCandidate } from "../kanji/build-data";
import type { KanjiEntry } from "../kanji/data";
import type { KanjiCardAi } from "../cards/schema";
import { BASE_PROMPT, CARD_JUDGE_PROMPT, kanjiFacts, MODES, retryNote, wordCount } from "./prompts";

// 학교 API 주소는 Anthropic SDK 관례(/v1 없이)로 받는다. AI SDK는 /v1까지 붙은 주소를 쓰므로 맞춰 준다
function anthropicBaseURL() {
  const url = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) return "https://api.anthropic.com/v1";
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

export const anthropicProvider = () => createAnthropic({ baseURL: anthropicBaseURL() });

export const cardModelId = () => process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
// 검증 규칙 5(판정)를 실시간으로도 돌려서 빠르고 싼 모델을 기본으로 둔다. eval의 판정 모델(ANTHROPIC_JUDGE_MODEL, Opus)과 따로다
export const cardJudgeModelId = () => process.env.ANTHROPIC_CARD_JUDGE_MODEL || "claude-haiku-5-5";

// Haiku 5.5는 기본으로 먼저 생각(adaptive thinking)하는데, 그 토큰이 출력 한도를 다 써서 본문이 빈 채로 끝났다.
// 짧은 카드라 생각을 끈다 (Sonnet·Opus 5.5는 끌 수 없어 모델을 바꾸면 같은 문제가 생긴다)
const NO_THINKING = { anthropic: { thinking: { type: "disabled" } } satisfies AnthropicLanguageModelOptions };

// feedback: 앞 시도가 검증에 떨어진 사유 (재생성 1회에만)
export function kanjiCardRequest(char: string, entry: KanjiEntry, candidates: WordCandidate[], feedback: string[] = []) {
  const mode = MODES.kanji;
  return {
    modelId: cardModelId(),
    instructions: `${BASE_PROMPT}\n\n${mode.instruction(char, wordCount(candidates))}`,
    prompt: kanjiFacts(char, entry, candidates) + (feedback.length > 0 ? retryNote(feedback) : ""),
    maxOutputTokens: mode.maxOutputTokens,
    // temperature는 넣지 않는다 — Haiku 5.5가 받지 않는다(무시 경고). 같은 글자 같은 카드는 저장으로 보장한다 (card-pipeline)
    providerOptions: NO_THINKING,
  };
}

export function cardJudgeRequest(char: string, entry: KanjiEntry, candidates: WordCandidate[], card: KanjiCardAi) {
  const glosses = card.words.map((w) => {
    const found = candidates.find(([written]) => written === w.written);
    return `- ${w.written} ${w.reading}: ${found?.[2] ?? "(후보에 없음)"}`;
  });
  return {
    modelId: cardJudgeModelId(),
    instructions: CARD_JUDGE_PROMPT,
    prompt: [
      `한자: ${char}`,
      `영어 뜻(KANJIDIC2): ${entry.meaningsEn.join(", ")}`,
      `카드 단어의 JMdict 영어 뜻:\n${glosses.join("\n") || "(단어 없음)"}`,
      `카드:\n<card>\n${JSON.stringify(card, null, 2)}\n</card>`,
    ].join("\n\n"),
    maxOutputTokens: 600,
    providerOptions: NO_THINKING,
  };
}
