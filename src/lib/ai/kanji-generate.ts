// 한자 카드 생성 설정. /api/kanji와 eval(scripts/eval-kanji.ts)이 같은 설정을 쓰게 한 곳에 둔다 — eval이 화면과 다른 걸 재면 숫자가 의미 없다.
// 키·주소는 서버 환경 변수에서만 읽는다.
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { BASE_PROMPT, MODES } from "./prompts";

// 학교 API 주소는 Anthropic SDK 관례(/v1 없이)로 받는다. AI SDK는 /v1까지 붙은 주소를 쓰므로 맞춰 준다
function anthropicBaseURL() {
  const url = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) return "https://api.anthropic.com/v1";
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

export const anthropicProvider = () => createAnthropic({ baseURL: anthropicBaseURL() });

export function kanjiCardRequest(char: string) {
  const mode = MODES.kanji;
  return {
    modelId: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
    instructions: `${BASE_PROMPT}\n\n${mode.instruction(char)}`,
    prompt: char,
    maxOutputTokens: mode.maxOutputTokens,
    // Haiku 5.5는 기본으로 먼저 생각(adaptive thinking)하는데, 그 토큰이 출력 한도를 다 써서 본문이 빈 채로 끝났다.
    // 짧은 형식 카드라 생각을 끈다 (Sonnet·Opus 5.5는 끌 수 없어 ANTHROPIC_MODEL로 바꾸면 같은 문제가 생긴다)
    providerOptions: { anthropic: { thinking: { type: "disabled" } } satisfies AnthropicLanguageModelOptions },
  };
}
