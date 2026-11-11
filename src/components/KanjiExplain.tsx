"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { parseFurigana, wordFurigana, type FuriganaToken } from "@/lib/ai/furigana";
import type { CardErrorKind, CardErrorResponse, KanjiCardAi, KanjiCardResponse } from "@/lib/cards/schema";
import { isKanji } from "@/lib/kanji/loader";
import Badge, { CARD_BADGES, SOURCE_BADGES } from "./Badge";

// 같은 글자는 다시 요청하지 않는다 (페이지를 떠났다 돌아와도 유지, 새로고침하면 초기화)
const cache = new Map<string, KanjiCardResponse>();

type FailKind = CardErrorKind | "network";
type State = { status: "loading" } | { status: "done"; data: KanjiCardResponse } | { status: "error"; kind: FailKind };

// 실패 원인을 나눠 말한다 (AGENTS 절대 규칙 4). 사전 섹션·획순은 이 칸 밖이라 그대로 남는다
const FAIL_TEXT: Record<FailKind, { title: string; detail: string }> = {
  network: { title: "AI 설명을 불러오지 못했어요.", detail: "인터넷 연결을 확인하고 다시 시도해 주세요." },
  ai: { title: "AI 설명을 불러오지 못했어요.", detail: "AI 서버가 응답하지 않았어요. 잠시 후 다시 시도해 주세요." },
  config: { title: "AI 설명을 불러오지 못했어요.", detail: "AI 서버가 응답하지 않았어요. 잠시 후 다시 시도해 주세요." },
  "rate-limit": { title: "AI 설명을 불러오지 못했어요.", detail: "요청이 많아요. 잠시 후 다시 시도해 주세요." },
  verify: {
    title: "설명을 준비하지 못했어요.",
    detail: "AI가 만든 설명이 사전 확인을 통과하지 못해 보여 드리지 않아요. 읽기와 한국 한자는 위의 사전 정보를 보세요.",
  },
  input: { title: "설명을 준비하지 못했어요.", detail: "이 글자는 AI 설명을 만들 수 없어요." },
  "no-data": { title: "설명을 준비하지 못했어요.", detail: "이 글자는 AI 설명을 만들 수 없어요." },
};

async function fetchCard(char: string, signal: AbortSignal): Promise<State> {
  let res: Response;
  try {
    res = await fetch("/api/kanji", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ char }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    return { status: "error", kind: "network" };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && (body as KanjiCardResponse | null)?.status === "auto_verified") return { status: "done", data: body as KanjiCardResponse };
  const kind = (body as CardErrorResponse | null)?.kind;
  return { status: "error", kind: kind && Object.hasOwn(FAIL_TEXT, kind) ? kind : "ai" };
}

// AI 한자 설명 카드 v2 (card-pipeline). 서버가 검증을 통과시킨 카드만 받는다. 열면 자동 요청, 사용자 입력 없음.
export default function KanjiExplain({ char }: { char: string }) {
  const cached = cache.get(char);
  const [state, setState] = useState<State>(cached ? { status: "done", data: cached } : { status: "loading" });
  // [다시 시도]마다 올려서 요청을 새로 건다
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(char)) return;
    const controller = new AbortController();
    fetchCard(char, controller.signal)
      .then((next) => {
        if (next.status === "done") cache.set(char, next.data);
        setState(next);
      })
      .catch(() => {}); // 페이지를 떠나 요청을 끊은 경우
    return () => controller.abort(); // 글자를 바꾸거나 페이지를 떠나면 요청도 멈춘다
  }, [char, attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <section aria-label="AI 설명" aria-busy={state.status === "loading"} className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted">AI 설명</h2>
        {state.status === "done" && <Badge>{CARD_BADGES[state.data.status]}</Badge>}
      </div>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
        {state.status === "loading" && <Skeleton />}
        {state.status === "done" && <CardBody card={state.data.card} current={char} />}
        {state.status === "error" && (
          <div role="alert">
            <p className="text-base text-ink">{FAIL_TEXT[state.kind].title}</p>
            <p className="mt-1 text-sm text-muted">{FAIL_TEXT[state.kind].detail}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 h-11 rounded-[14px] border border-accent bg-surface px-5 text-[15px] font-semibold text-accent active:bg-accent-soft"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="AI가 설명을 쓰고 확인하는 중">
      <div className="space-y-3 motion-safe:animate-pulse" aria-hidden>
        <div className="h-4 w-1/3 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-4 w-1/2 rounded bg-line" />
        <div className="h-4 w-5/6 rounded bg-line" />
      </div>
      <p className="mt-3 text-sm text-muted">설명을 쓰고 사전과 맞는지 확인하는 중…</p>
    </div>
  );
}

function Block({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-muted">{title}</h3>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CardBody({ card, current }: { card: KanjiCardAi; current: string }) {
  return (
    <div className="space-y-4 text-base text-ink">
      <Block title="뜻">
        <p>{card.meaningKo}</p>
      </Block>

      {card.words.length > 0 && (
        // 단어 표기·읽기는 JMdict 후보와 서버가 대조했다 (뜻은 AI)
        <Block title="자주 쓰는 단어" badge={SOURCE_BADGES.jmdict}>
          <ul className="space-y-1 leading-[1.9]">
            {card.words.map((w) => (
              <li key={w.written} className="flex flex-wrap items-baseline gap-x-2">
                <span lang="ja" className="font-jp text-lg">
                  <Furigana tokens={wordFurigana(w.written, w.reading)} current={current} />
                </span>
                <span>{w.meaningKo}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="예문">
        <p lang="ja" className="font-jp leading-[1.9]">
          <Furigana tokens={parseFurigana(card.example.ja)} current={current} />
        </p>
        <p className="mt-0.5 text-muted">{card.example.ko}</p>
      </Block>

      <p className="text-sm text-muted">AI가 만든 설명이라 틀릴 수 있어요.</p>
    </div>
  );
}

// {漢字|よみ} 토큰 → <ruby>. 루비 안 한자는 그 글자의 획순 페이지로 이어진다
function Furigana({ tokens, current }: { tokens: FuriganaToken[]; current: string }) {
  return tokens.map((t, i) =>
    t.type === "text" ? (
      <Fragment key={i}>{t.text}</Fragment>
    ) : (
      <ruby key={i} className="[ruby-align:center]">
        {[...t.base].map((c, j) => (
          <KanjiChar key={j} char={c} current={current} />
        ))}
        <rt>{t.reading}</rt>
      </ruby>
    ),
  );
}

// 지금 보고 있는 글자는 링크로 만들지 않는다
function KanjiChar({ char, current }: { char: string; current: string }) {
  if (!isKanji(char) || char === current) return <>{char}</>;
  return (
    <Link
      href={`/kanji/${encodeURIComponent(char)}`}
      prefetch={false}
      aria-label={`${char} 획순 보기`}
      className="rounded-sm py-2.5 underline decoration-accent/40 decoration-dotted underline-offset-[6px] active:bg-accent-soft"
    >
      {char}
    </Link>
  );
}
