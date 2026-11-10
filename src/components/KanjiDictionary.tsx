import type { KanjiEntry, Kun } from "@/lib/kanji/data";
import Badge, { SOURCE_BADGES } from "./Badge";

// 정답이 있는 정보(읽기·획수·학년·한국 자형·한국 음)는 사전 데이터로만 보여준다 (정확도 원칙 1·4).
// 서버에서 그리는 섹션이라 AI 설명이 실패해도 그대로 남는다.
export default function KanjiDictionary({ char, entry }: { char: string; entry: KanjiEntry }) {
  return (
    <>
      <Section title="사전" badge={SOURCE_BADGES.kanjidic2}>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2.5">
          <Row label="음독">
            <Readings items={entry.on} />
          </Row>
          <Row label="훈독">
            <Readings items={entry.kun.map((k) => <KunReading key={k.reading} kun={k} />)} />
          </Row>
          <Row label="획수">{entry.strokes[0]}획</Row>
          {entry.grade !== null && <Row label="학년">{gradeLabel(entry.grade)}</Row>}
        </dl>
      </Section>

      <Section title="한국 한자" badge={SOURCE_BADGES.unihan}>
        {entry.ko.diff !== "none" && <FormCompare char={char} ko={entry.ko} />}
        {entry.koReading.length > 0 && (
          <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-x-3 first:mt-0">
            {/* 한국 자형이 없으면 한국 음은 KANJIDIC2 korean_h에서 온다 (ACCURACY 1장) */}
            <Row label="한국 음">
              {entry.koReading.join(" · ")}
              {entry.ko.diff === "none" && <span className="ml-2 text-sm text-muted">(KANJIDIC2)</span>}
            </Row>
          </dl>
        )}
        <p className="mt-3 text-sm text-muted first:mt-0">{diffNote(entry)}</p>
      </Section>
    </>
  );
}

function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted">{title}</h2>
        <Badge>{badge}</Badge>
      </div>
      <div className="mt-2 rounded-2xl border border-line bg-surface p-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-sm text-muted">{label}</dt>
      <dd className="text-base text-ink">{children}</dd>
    </>
  );
}

function Readings({ items }: { items: React.ReactNode[] }) {
  if (items.length === 0) return <span className="text-muted">없음</span>;
  // 구분점은 앞 읽기에 붙여 줄 바꿈이 "·"로 시작하지 않게 한다
  return (
    <span lang="ja" className="font-jp">
      {items.map((item, i) => (
        <span key={i}>
          <span className="whitespace-nowrap">
            {item}
            {i < items.length - 1 && <span className="text-muted"> ·</span>}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}

// まな.ぶ → まな(ぶ): 오쿠리가나를 흐리게. 앞뒤 -는 접두·접미어로 쓰인다는 표시라 그대로 둔다
function KunReading({ kun }: { kun: Kun }) {
  return (
    <span className="whitespace-nowrap">
      {kun.stem}
      {kun.okurigana && <span className="text-muted">({kun.okurigana})</span>}
    </span>
  );
}

// KANJIDIC2 grade: 1~6 = 일본 초등학교 학년(교육한자), 8 = 그 밖의 상용한자(중학교 이후)
function gradeLabel(grade: number): string {
  if (grade >= 1 && grade <= 6) return `초등학교 ${grade}학년`;
  if (grade === 8) return "중학교 이후";
  return "상용한자 외";
}

// 같은 글자는 일본·한국 글꼴로 나란히 (코드포인트는 같아도 글꼴에 따라 모양이 다른 글자: 直·骨·角),
// 다른 자형이면 일본 글자와 한국 자형(여럿일 수 있음: 弁 → 辨·辯·瓣)을 나란히
function FormCompare({ char, ko }: { char: string; ko: KanjiEntry["ko"] }) {
  const same = ko.diff === "same";
  const cells = [
    { ch: char, lang: "ja", label: same ? "일본 글꼴" : "일본" },
    ...(same
      ? [{ ch: char, lang: "ko", label: "한국 글꼴" }]
      : ko.forms.map((f) => ({ ch: f, lang: "ko", label: "한국" }))),
  ];

  return (
    <ul className="flex flex-wrap gap-3">
      {cells.map(({ ch, lang, label }, i) => (
        <li key={i} className="flex flex-col items-center gap-1">
          <span
            lang={lang}
            className={`flex size-16 items-center justify-center rounded-[6px] border border-line bg-paper text-[40px] leading-none text-ink ${lang === "ja" ? "font-jp" : "font-sans"}`}
          >
            {ch}
          </span>
          <span className="text-sm text-muted">{label}</span>
        </li>
      ))}
    </ul>
  );
}

function diffNote(entry: KanjiEntry): string {
  switch (entry.ko.diff) {
    case "same":
      return "한국 한자와 같은 글자예요. 글꼴에 따라 모양이 조금 달라 보일 수 있어요.";
    case "form":
      return "한국 한자와 자형이 달라요. 일본어 시험·문서에서는 일본 자형으로 써요.";
    case "none":
      // KANJIDIC2 영어 뜻의 "(kokuji)" 표시 = 일본에서 만든 글자 (込·働·枠)
      return entry.meaningsEn.includes("(kokuji)")
        ? "일본에서 만든 글자(国字)라 대응하는 한국 한자가 없어요."
        : "사전 데이터(Unihan)에서 대응하는 한국 자형을 찾지 못했어요.";
  }
}
