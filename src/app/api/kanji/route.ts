import { createHash } from "node:crypto";
import { getCache, ipAddress, waitUntil } from "@vercel/functions";
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { isCompleteCard } from "@/lib/ai/kanji-card";
import { anthropicProvider, kanjiCardRequest } from "@/lib/ai/kanji-generate";
import { isKanji } from "@/lib/kanji/loader";

// 같은 글자의 설명은 모든 사용자가 공유해 학교 API 호출을 글자당 한 번으로 묶는다 (Vercel Runtime Cache, 로컬은 메모리).
// 틀린 설명이 오래 남지 않게 7일만 둔다. 한꺼번에 지우려면 getCache().expireTag("kanji-ai")
const CACHE_TTL = 60 * 60 * 24 * 7;
const CACHE_TAG = "kanji-ai";
// 저장 기준(isCompleteCard)을 바꾸면 올려서 예전 기준으로 저장된 설명을 버린다
const CACHE_VERSION = 2;

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

  const card = kanjiCardRequest(char);
  const { modelId: model, instructions } = card;
  // 프롬프트나 모델이 바뀌면 키가 달라져서 예전 설명을 다시 쓰지 않는다.
  // 키는 ASCII만 — Runtime Cache가 키를 HTTP 헤더(x-vercel-cache-item-name)로도 보내는데, 한자가 들어가면 저장이 조용히 실패했다
  const codePoint = char.codePointAt(0)!.toString(16).toUpperCase();
  const hash = createHash("sha256").update(`${CACHE_VERSION}\n${model}\n${instructions}`).digest("hex").slice(0, 12);
  const key = `kanji:U+${codePoint}:${hash}`;

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

  // 생성 설정(모델·프롬프트·생각 끄기)은 eval과 같이 쓴다 (src/lib/ai/kanji-generate.ts)
  const result = streamText({
    model: anthropicProvider()(model),
    instructions,
    prompt: card.prompt,
    maxOutputTokens: card.maxOutputTokens,
    providerOptions: card.providerOptions,
    abortSignal: req.signal,
  });

  // 끝까지 완성된 설명만 저장한다. 잘리거나 형식이 깨진 응답은 다음 요청에서 다시 만든다.
  // 저장 예약은 요청 처리 중에 건다 — Vercel 캐시·waitUntil은 요청 컨텍스트에서 찾기 때문에,
  // 스트림이 끝난 뒤 불리는 콜백(onEnd) 안보다 여기가 안전하다
  waitUntil(
    Promise.all([result.text, result.finishReason])
      .then(([text, finishReason]) => {
        if (finishReason !== "stop" || !isCompleteCard(text)) return;
        return cache.set(key, text, { ttl: CACHE_TTL, tags: [CACHE_TAG] });
      })
      .catch((error) => console.error("[api/kanji] cache set", error)),
  );

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[api/kanji]", error);
      return "AI 설명을 불러오지 못했어요.";
    },
  });
}
