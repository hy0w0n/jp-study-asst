"use client";

import { useCompletion } from "@ai-sdk/react";
import Link from "next/link";
import { Fragment, useEffect, useEffectEvent, useState } from "react";
import { parseFurigana } from "@/lib/ai/furigana";
import { isKanji } from "@/lib/kanji/loader";

// 같은 글자는 다시 요청하지 않는다 (페이지를 떠났다 돌아와도 유지, 새로고침하면 초기화)
const cache = new Map<string, string>();

// 마지막 줄(예문 → 번역)까지 끝난 응답만 캐시한다. 토큰 상한에서 잘린 응답을 막는다.
const isComplete = (text: string) => /\*\*예문\*\*:[^\n]*→\s*\S/.test(text);

// AI 한자 설명 카드 (jp-tutor-prompt의 kanji 모드). 열면 자동 요청, 사용자 입력 없음.
export default function KanjiExplain({ char }: { char: string }) {
  const cached = cache.get(char);
  const [done, setDone] = useState(Boolean(cached));

  const { completion, complete, stop, error } = useCompletion({
    api: "/api/kanji",
    initialCompletion: cached,
    onFinish: (_prompt, text) => {
      setDone(true);
      if (isComplete(text)) cache.set(char, text);
    },
    onError: () => setDone(true),
  });

  const start = useEffectEvent(() => {
    void complete(char, { body: { char } });
  });

  useEffect(() => {
    if (cache.has(char)) return;
    start();
    return () => stop(); // 글자를 바꾸거나 페이지를 떠나면 생성도 멈춘다
  }, [char, stop]);

  function retry() {
    setDone(false);
    void complete(char, { body: { char } });
  }

  const failed = Boolean(error) || (done && !completion);
  const waiting = !completion && !failed;

  return (
    <section aria-label="AI 설명" aria-busy={waiting} className="mt-6">
      <h2 className="text-sm font-semibold text-muted">AI 설명</h2>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
        {waiting && <Skeleton />}
        {completion && <AiText text={completion} current={char} />}
        {failed && (
          <div role="alert" className={completion ? "mt-3" : undefined}>
            <p className="text-base text-ink">AI 설명을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 h-11 rounded-[14px] border border-accent bg-surface px-5 text-[15px] font-semibold text-accent active:bg-accent-soft"
            >
              다시 시도
            </button>
          </div>
        )}
        {done && completion && !failed && (
          <p className="mt-3 text-sm text-muted">AI가 만든 설명이라 틀릴 수 있어요.</p>
        )}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="AI가 설명을 쓰는 중">
      <div className="space-y-3 motion-safe:animate-pulse" aria-hidden>
        <div className="h-4 w-2/3 rounded bg-line" />
        <div className="h-4 w-1/2 rounded bg-line" />
        <div className="h-4 w-full rounded bg-line" />
        <div className="h-4 w-5/6 rounded bg-line" />
      </div>
      <p className="mt-3 text-sm text-muted">설명을 쓰는 중…</p>
    </div>
  );
}

// kanji 모드 출력은 `**굵은 라벨**` + 줄 + `- ` 목록뿐이라 마크다운 라이브러리 없이 직접 그린다.
function AiText({ text, current }: { text: string; current: string }) {
  // 스트리밍 도중 `**`의 첫 `*`만 도착한 순간이 화면에 비치지 않게 한다
  const lines = text
    .replace(/(?<!\*)\*$/, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const blocks: (string | string[])[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else {
      blocks.push(line);
    }
  }

  return (
    <div className="space-y-2 text-base leading-[1.9] text-ink">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i} className="space-y-1 pl-1">
            {b.map((item, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden className="text-muted">
                  ・
                </span>
                <span>
                  <Inline text={item} current={current} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inline text={b} current={current} />
          </p>
        ),
      )}
    </div>
  );
}

// `**굵게**` → <strong>, `{漢字|よみ}` → <ruby>. 닫히지 않은 `**`는 열린 채로 굵게 보인다.
function Inline({ text, current }: { text: string; current: string }) {
  return text.split("**").map((part, i) => {
    const content = parseFurigana(part).map((t, j) =>
      t.type === "text" ? (
        <Fragment key={j}>{t.text}</Fragment>
      ) : (
        <ruby key={j} lang="ja" className="font-jp [ruby-align:center]">
          {[...t.base].map((c, k) => (
            <KanjiChar key={k} char={c} current={current} />
          ))}
          <rt>{t.reading}</rt>
        </ruby>
      ),
    );
    return i % 2 === 1 ? <strong key={i}>{content}</strong> : <Fragment key={i}>{content}</Fragment>;
  });
}

// 단어 속 한자는 그 글자의 획순 페이지로 이어진다. 지금 보고 있는 글자는 링크로 만들지 않는다.
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
