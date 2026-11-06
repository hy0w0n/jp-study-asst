"use client";

import { useState } from "react";
import KanjiCell from "./KanjiCell";

const EXAMPLES = [
  { word: "履歴書", reading: "りれきしょ" },
  { word: "面接", reading: "めんせつ" },
  { word: "職", reading: "しょく" },
];

// T2: 화면만. 검색 결과 칩·바텀시트 연결은 T4에서.
export default function KanjiSearch() {
  const [query, setQuery] = useState("");

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="kanji-query" className="sr-only">
          한자 검색
        </label>
        <div className="flex h-14 items-center gap-3 rounded-[14px] border border-line bg-surface px-4 focus-within:border-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            id="kanji-query"
            type="search"
            lang="ja"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="한자를 입력하거나 붙여넣기"
            enterKeyHint="search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent font-jp text-[17px] text-ink outline-none placeholder:font-sans placeholder:text-muted"
          />
        </div>
      </form>

      <section aria-labelledby="examples-title" className="mt-8">
        <h2 id="examples-title" className="text-sm text-muted">
          이런 한자부터 찾아보세요
        </h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {EXAMPLES.map(({ word, reading }) => (
            <li key={word}>
              <button
                type="button"
                onClick={() => setQuery(word)}
                aria-label={`${word} (${reading}) 입력하기`}
                className="flex flex-col items-start gap-1.5 rounded-xl p-1 active:bg-accent-soft"
              >
                <span className="flex gap-0.5">
                  {[...word].map((ch, i) => (
                    <KanjiCell key={i} char={ch} size={44} />
                  ))}
                </span>
                <span lang="ja" className="px-0.5 font-jp text-[13px] text-muted">
                  {reading}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
