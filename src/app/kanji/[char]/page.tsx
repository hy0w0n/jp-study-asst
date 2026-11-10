import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import KanjiExplain from "@/components/KanjiExplain";
import KanjiStroke from "@/components/KanjiStroke";
import SaveKanjiButton from "@/components/SaveKanjiButton";
import { getKanji } from "@/lib/kanji/data";
import { isKana, isKanji, safeDecode } from "@/lib/kanji/loader";
import { japaneseFormsOf } from "@/lib/kanji/variants";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function KanjiPage({ params, searchParams }: PageProps<"/kanji/[char]">) {
  return (
    <main className="px-5 pt-2 pb-8">
      <Suspense fallback={<KanjiFallback />}>
        <KanjiDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function KanjiDetail({ params, searchParams }: { params: Promise<{ char: string }>; searchParams: SearchParams }) {
  const { char: raw } = await params;
  const { from } = await searchParams;
  const char = [...safeDecode(raw)][0] ?? "";
  if (!isKanji(char) && !isKana(char)) notFound();

  return (
    <>
      <Header char={char} />
      <VariantBanner char={char} from={from} />
      <div className="mt-4">
        <KanjiStroke key={char} char={char} />
      </div>

      {isKanji(char) && <KanjiExplain key={char} char={char} />}

      <div className="mt-6">
        <SaveKanjiButton />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        획순 데이터: hanzi-writer-data-jp (animCJK · Make Me a Hanzi 기반) — Arphic Public License,
        LGPL-3.0
      </p>
    </>
  );
}

function Header({ char }: { char: string }) {
  return (
    <header className="flex items-center gap-2">
      <Link
        href="/"
        aria-label="검색으로 돌아가기"
        className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-accent-soft"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      {char && (
        <h1 lang="ja" className="font-brush text-[48px] leading-none text-ink">
          {char}
        </h1>
      )}
    </header>
  );
}

// 검색·proxy가 한국 자형·구자체를 바꿔 왔을 때(?from=學) 안내한다.
// from은 주소에서 오므로 char의 실제 이체자일 때만 보여준다 (variants.json)
function VariantBanner({ char, from }: { char: string; from: string | string[] | undefined }) {
  if (typeof from !== "string" || !japaneseFormsOf(from).includes(char)) return null;
  // 한국 표준 자형이면 "한국", 일본 구자체이기만 하면(插 → 挿) "구자체"
  const korean = getKanji(char)?.ko.forms.includes(from) ?? false;

  return (
    <p role="note" className="mt-4 rounded-[12px] border border-line bg-surface px-4 py-3 text-base text-ink">
      <span className="font-semibold">
        {korean ? "한국" : "구자체"} <span lang={korean ? "ko" : "ja"}>{from}</span> → 일본{" "}
        <span lang="ja" className="font-jp">
          {char}
        </span>
      </span>
      <span className="mt-0.5 block text-sm text-muted">일본에서 쓰는 자형과 획순을 보여 드려요.</span>
    </p>
  );
}

function KanjiFallback() {
  return (
    <>
      <Header char="" />
      <div className="mx-auto mt-12 aspect-square w-full max-w-[300px] rounded-[6px] border border-line bg-surface" />
    </>
  );
}
