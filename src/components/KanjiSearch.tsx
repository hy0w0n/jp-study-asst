"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { searchHits } from "@/lib/kanji/search";
import { kanjiHref } from "@/lib/kanji/variants";
import KanjiCell from "./KanjiCell";

const EXAMPLES = [
  { word: "履歴書", reading: "りれきしょ" },
  { word: "面接", reading: "めんせつ" },
  { word: "職", reading: "しょく" },
];

// 타이핑·붙여넣기 검색: 한 글자면 바로 획순 화면으로, 여러 글자면 후보 칩을 보여 준다.
// 한국 자형·구자체(學)는 일본 신자체(学)로 바꿔 보여 준다.
export default function KanjiSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  // 검색을 실행한 입력값. 입력을 고치면 null로 돌아가 이전 결과를 숨긴다.
  const [searched, setSearched] = useState<string | null>(null);

  const hits = searched === null ? [] : searchHits(searched);
  const showChips = hits.length > 1;
  const showNotice = searched !== null && hits.length === 0;

  function search(text: string) {
    const found = searchHits(text);
    if (found.length === 1) {
      router.push(kanjiHref(found[0]));
      return;
    }
    inputRef.current?.blur(); // 키보드를 내려 결과가 가려지지 않게
    setSearched(text);
  }

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <label htmlFor="kanji-query" className="sr-only">
          한자 검색
        </label>
        <div className="flex h-14 items-center gap-3 rounded-[14px] border border-line bg-surface pr-1.5 pl-4 focus-within:border-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-muted">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            id="kanji-query"
            type="search"
            lang="ja"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearched(null);
            }}
            placeholder="한자를 입력하거나 붙여넣기"
            enterKeyHint="search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent font-jp text-[17px] text-ink outline-none placeholder:font-sans placeholder:text-muted"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-[10px] bg-accent px-4 text-[15px] font-semibold text-white active:opacity-90"
          >
            검색
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {showNotice && <p className="mt-3 px-1 text-sm text-accent">한자나 가나를 입력해 주세요</p>}

        {showChips && (
          <section aria-labelledby="result-title" className="mt-6">
            <h2 id="result-title" className="text-sm text-muted">
              글자를 탭하면 획순이 열려요
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {hits.map((hit) => (
                <li key={hit.char}>
                  <Link
                    href={kanjiHref(hit)}
                    aria-label={hit.from ? `${hit.from}의 일본 자형 ${hit.char} 획순 보기` : `${hit.char} 획순 보기`}
                    className="flex flex-col items-center gap-1 rounded-xl p-1 active:bg-accent-soft"
                  >
                    <KanjiCell char={hit.char} size={56} />
                    {hit.from && (
                      <span aria-hidden className="text-xs text-muted">
                        <span lang="ko">{hit.from}</span>→<span lang="ja">{hit.char}</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {!showChips && (
        <section aria-labelledby="examples-title" className="mt-8">
          <h2 id="examples-title" className="text-sm text-muted">
            이런 한자부터 찾아보세요
          </h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {EXAMPLES.map(({ word, reading }) => (
              <li key={word}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(word);
                    search(word);
                  }}
                  aria-label={`${word} (${reading}) 검색하기`}
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
      )}
    </div>
  );
}
