import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { BASE_PROMPT, MODES } from "@/lib/ai/prompts";
import { isKanji } from "@/lib/kanji/loader";

// 한자 상세 카드 (kanji 모드). 키는 서버에서만 쓴다.
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const char = typeof (body as { char?: unknown })?.char === "string" ? (body as { char: string }).char : "";

  // 한자 한 글자만 받는다 — 프롬프트에 그대로 들어가므로 임의 문장을 막고, 키가 아무 질문에나 쓰이지 않게 한다
  if ([...char].length !== 1 || !isKanji(char)) {
    return Response.json({ error: "한자 한 글자만 보낼 수 있어요." }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("[api/kanji] OPENAI_API_KEY is not set");
    return Response.json({ error: "AI 설정이 아직 안 되어 있어요." }, { status: 500 });
  }

  const mode = MODES.kanji;
  const result = streamText({
    model: openai(process.env.AI_MODEL ?? "gpt-5.4-mini"),
    instructions: `${BASE_PROMPT}\n\n${mode.instruction(char)}`,
    prompt: char,
    maxOutputTokens: mode.maxOutputTokens,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[api/kanji]", error);
      return "AI 설명을 불러오지 못했어요.";
    },
  });
}
