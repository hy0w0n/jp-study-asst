import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { BASE_PROMPT, MODES } from "@/lib/ai/prompts";
import { isKanji } from "@/lib/kanji/loader";

// 학교 API 주소는 Anthropic SDK 관례(/v1 없이)로 받는다. AI SDK는 /v1까지 붙은 주소를 쓰므로 맞춰 준다
function anthropicBaseURL() {
  const url = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) return "https://api.anthropic.com/v1";
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

// 한자 상세 카드 (kanji 모드). 키는 서버에서만 쓴다.
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const char = typeof (body as { char?: unknown })?.char === "string" ? (body as { char: string }).char : "";

  // 한자 한 글자만 받는다 — 프롬프트에 그대로 들어가므로 임의 문장을 막고, 키가 아무 질문에나 쓰이지 않게 한다
  if ([...char].length !== 1 || !isKanji(char)) {
    return Response.json({ error: "한자 한 글자만 보낼 수 있어요." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[api/kanji] ANTHROPIC_API_KEY is not set");
    return Response.json({ error: "AI 설정이 아직 안 되어 있어요." }, { status: 500 });
  }

  const anthropic = createAnthropic({ baseURL: anthropicBaseURL() });
  const mode = MODES.kanji;
  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || "claude-haiku-5-5"),
    instructions: `${BASE_PROMPT}\n\n${mode.instruction(char)}`,
    prompt: char,
    maxOutputTokens: mode.maxOutputTokens,
    // Haiku 5.5는 기본으로 먼저 생각(adaptive thinking)하는데, 그 토큰이 출력 한도를 다 써서 본문이 빈 채로 끝났다.
    // 짧은 형식 카드라 생각을 끈다 (Sonnet·Opus 5.5는 끌 수 없어 ANTHROPIC_MODEL로 바꾸면 같은 문제가 생긴다)
    providerOptions: { anthropic: { thinking: { type: "disabled" } } satisfies AnthropicLanguageModelOptions },
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[api/kanji]", error);
      return "AI 설명을 불러오지 못했어요.";
    },
  });
}
