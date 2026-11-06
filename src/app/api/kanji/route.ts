import { createHash } from "node:crypto";
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { getCache, ipAddress, waitUntil } from "@vercel/functions";
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { isCompleteCard } from "@/lib/ai/kanji-card";
import { BASE_PROMPT, MODES } from "@/lib/ai/prompts";
import { isKanji } from "@/lib/kanji/loader";

// 같은 글자의 설명은 모든 사용자가 공유해 학교 API 호출을 글자당 한 번으로 묶는다 (Vercel Runtime Cache, 로컬은 메모리).
// 틀린 설명이 오래 남지 않게 7일만 둔다. 한꺼번에 지우려면 getCache().expireTag("kanji-ai")
const CACHE_TTL = 60 * 60 * 24 * 7;
const CACHE_TAG = "kanji-ai";

// 새로 만드는 설명(= 학교 API 호출)만 IP당 10분 30번으로 막는다. 저장된 설명은 제한 없이 보낸다.
// 캐시에 숫자를 세는 근사치라 동시에 몰린 요청은 몇 개 더 통과할 수 있다 (방화벽 규칙을 쓸 수 없어서 코드로 둠)
const NEW_CARD_LIMIT = 30;
const NEW_CARD_WINDOW = 60 * 10;

async function overNewCardLimit(cache: ReturnType<typeof getCache>, ip: string) {
  const key = `kanji-limit:${ip}:${Math.floor(Date.now() / 1000 / NEW_CARD_WINDOW)}`;
  try {
    const used = await cache.get(key);
    const count = typeof used === "number" ? used : 0;
    if (count >= NEW_CARD_LIMIT) return true;
    await cache.set(key, count + 1, { ttl: NEW_CARD_WINDOW });
  } catch (error) {
    // 캐시가 안 되면 제한도 못 센다 — 카드는 보여주고 기록만 남긴다
    console.error("[api/kanji] limit", error);
  }
  return false;
}

// 학교 API 주소는 Anthropic SDK 관례(/v1 없이)로 받는다. AI SDK는 /v1까지 붙은 주소를 쓰므로 맞춰 준다
function anthropicBaseURL() {
  const url = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) return "https://api.anthropic.com/v1";
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

// 저장해 둔 설명을 모델 스트림과 같은 형식으로 한 번에 보낸다 (화면은 차이를 모른다)
function cachedResponse(text: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id: "cached" });
        writer.write({ type: "text-delta", id: "cached", delta: text });
        writer.write({ type: "text-end", id: "cached" });
        writer.write({ type: "finish", finishReason: "stop" });
      },
    }),
  });
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

  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const mode = MODES.kanji;
  const instructions = `${BASE_PROMPT}\n\n${mode.instruction(char)}`;
  // 프롬프트나 모델이 바뀌면 키가 달라져서 예전 설명을 다시 쓰지 않는다
  const key = `kanji:${char}:${createHash("sha256").update(`${model}\n${instructions}`).digest("hex").slice(0, 12)}`;

  const cache = getCache();
  // 캐시가 잠깐 안 돼도 카드는 나와야 한다 — 실패는 '없음'으로 보고 모델을 부른다
  const hit = await cache.get(key).catch((error) => {
    console.error("[api/kanji] cache get", error);
    return null;
  });
  if (typeof hit === "string") return cachedResponse(hit);

  if (await overNewCardLimit(cache, ipAddress(req) ?? "local")) {
    return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const anthropic = createAnthropic({ baseURL: anthropicBaseURL() });
  const result = streamText({
    model: anthropic(model),
    instructions,
    prompt: char,
    maxOutputTokens: mode.maxOutputTokens,
    // Haiku 5.5는 기본으로 먼저 생각(adaptive thinking)하는데, 그 토큰이 출력 한도를 다 써서 본문이 빈 채로 끝났다.
    // 짧은 형식 카드라 생각을 끈다 (Sonnet·Opus 5.5는 끌 수 없어 ANTHROPIC_MODEL로 바꾸면 같은 문제가 생긴다)
    providerOptions: { anthropic: { thinking: { type: "disabled" } } satisfies AnthropicLanguageModelOptions },
    abortSignal: req.signal,
    // 끝까지 완성된 설명만 저장한다. 잘리거나 형식이 깨진 응답은 다음 요청에서 다시 만든다
    onEnd: ({ text, finishReason }) => {
      if (finishReason !== "stop" || !isCompleteCard(text)) return;
      waitUntil(
        cache
          .set(key, text, { ttl: CACHE_TTL, tags: [CACHE_TAG] })
          .catch((error) => console.error("[api/kanji] cache set", error)),
      );
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[api/kanji]", error);
      return "AI 설명을 불러오지 못했어요.";
    },
  });
}
