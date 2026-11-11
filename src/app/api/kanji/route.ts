import { createHash } from "node:crypto";
import { getCache, ipAddress, waitUntil } from "@vercel/functions";
import { cardJudgeModelId, cardModelId } from "@/lib/ai/kanji-generate";
import { KANJI_PROMPT_VERSION } from "@/lib/ai/prompts";
import { createKanjiCard } from "@/lib/cards/generate";
import type { CardErrorKind, CardErrorResponse, KanjiCardResponse } from "@/lib/cards/schema";
import { DATA_VERSION, getKanji } from "@/lib/kanji/data";
import { isKanji } from "@/lib/kanji/loader";
import { getWordCandidates, WORDS_VERSION } from "@/lib/kanji/words";

// 같은 글자의 카드는 모든 사용자가 공유해 학교 API 호출을 글자당 한 번으로 묶는다 (Vercel Runtime Cache, 로컬은 메모리).
// 검증(src/lib/cards/verify.ts)을 통과한 카드만 저장한다. 7일만 두고, 한꺼번에 지우려면 getCache().expireTag("kanji-ai").
// 영구 저장(Supabase kanji_cards)은 #14
const CACHE_TTL = 60 * 60 * 24 * 7;
const CACHE_TAG = "kanji-ai";
// 저장하는 카드 모양·검증 기준을 바꾸면 올려서 예전 카드를 버린다 (v1 텍스트 카드 = 2)
const CACHE_VERSION = 3;
// 생성·판정·재생성을 모두 합친 상한. 넘으면 AI 오류로 답한다
const PIPELINE_TIMEOUT_MS = 30_000;

// 새로 만드는 카드(= 학교 API 호출)만 IP당 10분 30번으로 막는다. 저장된 카드는 제한 없이 보낸다.
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
    // 캐시가 안 되면 제한도 못 센다 — 카드는 만들고 기록만 남긴다
    console.error("[api/kanji] limit", error);
  }
  return false;
}

const fail = (kind: CardErrorKind, error: string, status: number) =>
  Response.json({ error, kind } satisfies CardErrorResponse, { status });

const isCardResponse = (value: unknown): value is KanjiCardResponse =>
  typeof value === "object" && value !== null && (value as KanjiCardResponse).status === "auto_verified";

// 한자 카드 v2 (kanji 모드). 검증 전에는 보여줄 수 없어 스트리밍하지 않고 JSON 한 번으로 답한다. 키는 서버에서만 쓴다.
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const char = typeof (body as { char?: unknown })?.char === "string" ? (body as { char: string }).char : "";

  // 한자 한 글자만 받는다 — 프롬프트에 그대로 들어가므로 임의 문장을 막고, 키가 아무 질문에나 쓰이지 않게 한다
  if ([...char].length !== 1 || !isKanji(char)) return fail("input", "한자 한 글자만 보낼 수 있어요.", 400);
  // 사전 사실(kanji.json)·단어 후보(words.json)가 있는 상용한자만 만든다 — 사실 없이 만들면 읽기·단어를 검증할 수 없다
  const entry = getKanji(char);
  if (!entry) return fail("no-data", "상용한자만 AI 설명을 만들어요.", 404);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[api/kanji] ANTHROPIC_API_KEY is not set");
    return fail("config", "AI 설정이 아직 안 되어 있어요.", 500);
  }

  const model = cardModelId();
  const judgeModel = cardJudgeModelId();
  const dataVersion = `${DATA_VERSION}+${WORDS_VERSION}`;
  // 프롬프트·데이터·모델이 바뀌면 키가 달라져서 예전 카드를 다시 쓰지 않는다.
  // 키는 ASCII만 — Runtime Cache가 키를 HTTP 헤더(x-vercel-cache-item-name)로도 보내는데, 한자가 들어가면 저장이 조용히 실패했다
  const codePoint = char.codePointAt(0)!.toString(16).toUpperCase();
  const hash = createHash("sha256")
    .update([CACHE_VERSION, KANJI_PROMPT_VERSION, dataVersion, model, judgeModel].join("\n"))
    .digest("hex")
    .slice(0, 12);
  const key = `kanji:U+${codePoint}:${hash}`;

  const cache = getCache();
  // 캐시가 잠깐 안 돼도 카드는 나와야 한다 — 실패는 '없음'으로 보고 새로 만든다
  const hit = await cache.get(key).catch((error) => {
    console.error("[api/kanji] cache get", error);
    return null;
  });
  if (isCardResponse(hit)) return Response.json(hit);

  if (await overNewCardLimit(cache, ipAddress(req) ?? "local")) {
    return fail("rate-limit", "잠시 후 다시 시도해 주세요.", 429);
  }

  try {
    const result = await createKanjiCard(char, entry, getWordCandidates(char), {
      abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(PIPELINE_TIMEOUT_MS)]),
      lookup: getKanji,
    });
    if (result.status === "rejected") {
      // 검증에 두 번 떨어진 카드는 보여주지도 저장하지도 않는다. 사유는 정확도 개선 재료라 로그에 남긴다
      console.warn(`[api/kanji] rejected ${char}`, JSON.stringify(result.failures));
      return fail("verify", "검증을 통과한 설명을 만들지 못했어요.", 422);
    }
    const card: KanjiCardResponse = {
      card: result.card,
      status: "auto_verified",
      verification: {
        promptVersion: KANJI_PROMPT_VERSION,
        dataVersion,
        model: result.model,
        judgeModel: result.judgeModel,
        judge: { meaning: result.judgement.meaning.score, words: result.judgement.words.score, translation: result.judgement.translation.score },
        attempts: result.attempts,
        generatedAt: new Date().toISOString(),
      },
    };
    // 저장을 기다리지 않고 답한다 (waitUntil은 요청 컨텍스트 안에서 건다)
    waitUntil(cache.set(key, card, { ttl: CACHE_TTL, tags: [CACHE_TAG] }).catch((error) => console.error("[api/kanji] cache set", error)));
    return Response.json(card);
  } catch (error) {
    console.error("[api/kanji]", error);
    return fail("ai", "AI 설명을 불러오지 못했어요.", 502);
  }
}
