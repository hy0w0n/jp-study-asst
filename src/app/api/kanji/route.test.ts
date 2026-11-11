import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CARD } from "@/lib/cards/__fixtures__/kanji-card";
import type { CardErrorResponse, KanjiCardResponse } from "@/lib/cards/schema";

// Vercel Runtime Cache·waitUntil과 AI 파이프라인만 가짜로 둔다. 사전 데이터(kanji.json·words.json)는 실제 파일
const { store, cache, pending, createKanjiCard } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return {
    store,
    cache: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
    },
    pending: [] as Promise<unknown>[],
    createKanjiCard: vi.fn(),
  };
});
vi.mock("@vercel/functions", () => ({
  getCache: () => cache,
  ipAddress: () => "203.0.113.1",
  waitUntil: (p: Promise<unknown>) => void pending.push(p),
}));
vi.mock("@/lib/cards/generate", () => ({ createKanjiCard }));

import { POST } from "./route";

const NOW = new Date("2026-11-11T03:00:00Z");
const PASSED = {
  status: "auto_verified",
  card: SAMPLE_CARD,
  judgement: { meaning: { score: 5, reason: "" }, words: { score: 4, reason: "" }, translation: { score: 5, reason: "" } },
  attempts: 1,
  usage: { generation: { input: 1, output: 1 }, judge: { input: 1, output: 1 } },
  failures: [],
  model: "claude-haiku-5-5",
  judgeModel: "claude-haiku-5-5",
};

const post = (char: unknown) =>
  POST(new Request("http://localhost/api/kanji", { method: "POST", body: JSON.stringify({ char }) }));
const cardKeys = () => cache.set.mock.calls.map(([key]) => key as string).filter((key) => key.startsWith("kanji:"));

beforeEach(() => {
  store.clear();
  pending.length = 0;
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("POST /api/kanji", () => {
  it("한자 한 글자가 아니면 400 input — 모델을 부르지 않는다", async () => {
    for (const char of ["", "職業", "あ", "a", 1]) {
      const res = await post(char);
      expect(res.status).toBe(400);
      expect(((await res.json()) as CardErrorResponse).kind).toBe("input");
    }
    expect(createKanjiCard).not.toHaveBeenCalled();
  });

  it("상용한자가 아니면(薔) 404 no-data — 사전 사실이 없어 만들지 않는다", async () => {
    const res = await post("薔");
    expect(res.status).toBe(404);
    expect(((await res.json()) as CardErrorResponse).kind).toBe("no-data");
    expect(createKanjiCard).not.toHaveBeenCalled();
  });

  it("키가 없으면 500 config", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await post("職");
    expect(res.status).toBe(500);
    expect(((await res.json()) as CardErrorResponse).kind).toBe("config");
  });

  it("검증을 통과한 카드를 JSON으로 답하고 ASCII 키로 캐시에 저장한다", async () => {
    createKanjiCard.mockResolvedValueOnce(PASSED);
    const res = await post("職");
    expect(res.status).toBe(200);
    const body = (await res.json()) as KanjiCardResponse;
    expect(body).toMatchObject({ card: SAMPLE_CARD, status: "auto_verified", verification: { judge: { meaning: 5, words: 4, translation: 5 }, attempts: 1 } });

    // 사전 사실·단어 후보·읽기 대조용 사전 조회를 넘긴다
    const [char, entry, candidates, options] = createKanjiCard.mock.calls[0];
    expect(char).toBe("職");
    expect(entry.on).toEqual(["ショク", "ソク"]);
    expect(candidates.length).toBeGreaterThan(0);
    expect(options.lookup("学")?.on).toEqual(["ガク"]);

    await Promise.all(pending);
    expect(cardKeys()).toHaveLength(1);
    expect(cardKeys()[0]).toMatch(/^kanji:U\+8077:[0-9a-f]{12}$/);
  });

  it("저장된 카드가 있으면 모델을 다시 부르지 않는다", async () => {
    createKanjiCard.mockResolvedValueOnce(PASSED);
    await post("職");
    await Promise.all(pending);
    const res = await post("職");
    expect(res.status).toBe(200);
    expect(((await res.json()) as KanjiCardResponse).card).toEqual(SAMPLE_CARD);
    expect(createKanjiCard).toHaveBeenCalledTimes(1);
  });

  it("검증에 두 번 떨어진 카드는 422 verify — 저장하지 않는다", async () => {
    createKanjiCard.mockResolvedValueOnce({ ...PASSED, status: "rejected", attempts: 2, failures: [["example: 예문에 職가 없음"], ["judge: meaning 2점"]] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post("職");
    expect(res.status).toBe(422);
    expect(((await res.json()) as CardErrorResponse).kind).toBe("verify");
    await Promise.all(pending);
    expect(cardKeys()).toEqual([]);
  });

  it("모델·네트워크 오류는 502 ai", async () => {
    createKanjiCard.mockRejectedValueOnce(new Error("Cannot connect to API"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("職");
    expect(res.status).toBe(502);
    expect(((await res.json()) as CardErrorResponse).kind).toBe("ai");
  });

  it("새 카드는 IP당 10분 30번까지 — 넘으면 429 rate-limit", async () => {
    store.set(`kanji-limit:203.0.113.1:${Math.floor(NOW.getTime() / 1000 / 600)}`, 30);
    const res = await post("職");
    expect(res.status).toBe(429);
    expect(((await res.json()) as CardErrorResponse).kind).toBe("rate-limit");
    expect(createKanjiCard).not.toHaveBeenCalled();
  });
});
