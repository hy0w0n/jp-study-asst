import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import KanjiExplain from "@/components/KanjiExplain";
import KanjiStroke from "@/components/KanjiStroke";
import SaveKanjiButton from "@/components/SaveKanjiButton";
import { isKana, isKanji, safeDecode } from "@/lib/kanji/loader";

export default function KanjiPage({ params }: PageProps<"/kanji/[char]">) {
  return (
    <main className="px-5 pt-2 pb-8">
      <Suspense fallback={<KanjiFallback />}>
        <KanjiDetail params={params} />
      </Suspense>
    </main>
  );
}

async function KanjiDetail({ params }: { params: Promise<{ char: string }> }) {
  const { char: raw } = await params;
  const char = [...safeDecode(raw)][0] ?? "";
  if (!isKanji(char) && !isKana(char)) notFound();

  return (
    <>
      <Header char={char} />
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

function KanjiFallback() {
  return (
    <>
      <Header char="" />
      <div className="mx-auto mt-12 aspect-square w-full max-w-[300px] rounded-[6px] border border-line bg-surface" />
    </>
  );
}
