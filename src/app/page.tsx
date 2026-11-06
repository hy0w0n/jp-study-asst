import KanjiSearch from "@/components/KanjiSearch";

export default function Home() {
  return (
    <main className="px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-8">
      <header className="flex h-11 items-center">
        <ruby className="text-lg font-bold tracking-[0.08em] text-accent">
          SENSE<rt lang="ja" className="tracking-normal">センセ</rt>
        </ruby>
      </header>

      <h1 className="mt-6 text-[26px] font-bold leading-snug">
        모르는 한자,
        <br />
        획순부터 바로 보여줄게요
      </h1>
      <p className="mt-2 text-base text-muted">일본식 획순과 뜻·읽기를 한 번에.</p>

      <div className="mt-7">
        <KanjiSearch />
      </div>
    </main>
  );
}
