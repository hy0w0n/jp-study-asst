// 사전 데이터 빌드의 순수 변환 (KANJIDIC2 JSON + Unihan 텍스트 → kanji.json·variants.json).
// 다운로드·파일 쓰기는 scripts/build-kanji-data.ts가 맡는다. 규칙: .claude/skills/kanji-data
import type { KanjiEntry, KoBasis, KoDiff, Kun } from "./data";

// ── KANJIDIC2 (jmdict-simplified JSON) ──────────────────────────────

export type Kanjidic2Reading = { type: string; value: string };
export type Kanjidic2Char = {
  literal: string;
  misc: {
    grade: number | null;
    strokeCounts: number[];
    frequency: number | null;
    jlptLevel: number | null;
  };
  readingMeaning: {
    groups: { readings: Kanjidic2Reading[]; meanings: { lang: string; value: string }[] }[];
  } | null;
};
export type Kanjidic2 = { version: string; dictDate: string; characters: Kanjidic2Char[] };

// 상용한자 = grade 1~6(교육한자) + 8(그 외 상용)
export function isJoyo(c: Kanjidic2Char): boolean {
  return c.misc.grade !== null && c.misc.grade <= 8;
}

function readingsOf(c: Kanjidic2Char, type: string): string[] {
  const groups = c.readingMeaning?.groups ?? [];
  return groups.flatMap((g) => g.readings.filter((r) => r.type === type).map((r) => r.value));
}

// "まな.ぶ" → まなぶ / まな / ぶ. 앞뒤 "-"(접두·접미 표시)는 그대로 둔다
export function splitKun(value: string): Kun {
  const dot = value.indexOf(".");
  if (dot < 0) return { reading: value, stem: value };
  return { reading: value.replace(".", ""), stem: value.slice(0, dot), okurigana: value.slice(dot + 1) };
}

// ── Unihan ──────────────────────────────────────────────────────────

// 자형 이체자 연결. kSemanticVariant(뜻이 같은 글자)는 부수가 같을 때만 쓰고(咲→笑 같은 다른 글자 제외),
// kSpecializedSemanticVariant(뜻이 일부만 겹침, 丼→井)는 쓰지 않는다
const GLYPH_VARIANT_FIELDS = ["kZVariant", "kCompatibilityVariant", "kTraditionalVariant", "kSimplifiedVariant"] as const;

const UNIHAN_FIELDS = [
  "kJapaneseOldVariant",
  ...GLYPH_VARIANT_FIELDS,
  "kSemanticVariant",
  "kIRG_KSource",
  "kHangul",
  "kKoreanEducationHanja",
  "kRSUnicode",
  "kTotalStrokes",
] as const;

type UnihanField = (typeof UNIHAN_FIELDS)[number];
export type Unihan = Record<UnihanField, Map<string, string>>;

export function codepointToChar(cp: string): string {
  return String.fromCodePoint(parseInt(cp.replace("U+", ""), 16));
}

// "U+5713 U+654E<kLau,kMatthews" → ["圓", "敎"] (꺾쇠 뒤 출처 표시는 버린다)
export function parseCodepoints(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(" ").filter(Boolean).map((t) => codepointToChar(t.split("<")[0]));
}

// "낙:0 락:0E" → ["낙", "락"]
export function parseHangul(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(" ").filter(Boolean).map((t) => t.split(":")[0]);
}

// 한국 학습자에게 익숙한 정도. 자형(koRank)과 음(rankedHangul)이 같은 순위를 쓴다
const KO_RANK = { education: 3, ksX1001: 2, ksX1002: 1, none: 0 } as const;

// kHangul 출처 표시를 한국 표준 순위로: 교육용 기초한자 E > KS X 1001 0 > KS X 1002 1 > 그 밖(인명용 N 등)
// "서:N 예:0E" → [{서, 0}, {예, 3}]
function rankedHangul(value: string | undefined): { reading: string; rank: number }[] {
  if (!value) return [];
  return value
    .split(" ")
    .filter(Boolean)
    .map((t) => {
      const [reading, src = ""] = t.split(":");
      const rank = src.includes("E")
        ? KO_RANK.education
        : src.includes("0")
          ? KO_RANK.ksX1001
          : src.includes("1")
            ? KO_RANK.ksX1002
            : KO_RANK.none;
      return { reading, rank };
    });
}

// 한국 자형들의 음을 합쳐 순위 높은 음부터 (같으면 Unihan 순서). 화면은 첫 음을 대표로 강조한다.
// 인명용 목록에만 있는 음(豫 서)은 한국 표준 음이 하나라도 있으면 뺀다 — 학습자가 대표 음으로 오해한다
export function koReadingsOf(values: (string | undefined)[]): string[] {
  const best = new Map<string, number>();
  for (const { reading, rank } of values.flatMap(rankedHangul)) {
    best.set(reading, Math.max(best.get(reading) ?? 0, rank));
  }
  const all = [...best];
  const standard = all.some(([, rank]) => rank > 0) ? all.filter(([, rank]) => rank > 0) : all;
  return standard.sort((a, b) => b[1] - a[1]).map(([reading]) => reading);
}

// Unihan 텍스트 줄 형식: U+XXXX<TAB>속성<TAB>값. 필요한 속성만 남긴다
export function parseUnihan(texts: string[]): Unihan {
  const fields = new Set<string>(UNIHAN_FIELDS);
  const out = Object.fromEntries(UNIHAN_FIELDS.map((f) => [f, new Map<string, string>()])) as Unihan;
  for (const text of texts) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("U+")) continue;
      const [cp, field, value] = line.split("\t");
      if (fields.has(field) && value) out[field as UnihanField].set(codepointToChar(cp), value.trim());
    }
  }
  return out;
}

// CJK 호환 한자(欄 U+F91D 등)는 NFC 정규화로 원래 글자가 되므로 별개의 자형으로 다루지 않는다
function isCompatibility(char: string): boolean {
  return char.normalize("NFC") !== char;
}

// ── 한국 자형 ───────────────────────────────────────────────────────

// 한국 학습자에게 익숙한 정도: 교육용 기초한자 1800자(2007) > KS X 1001(K0) > KS X 1002(K1) > 없음
function koRank(u: Unihan, char: string): number {
  if (u.kKoreanEducationHanja.has(char)) return KO_RANK.education;
  const k = u.kIRG_KSource.get(char) ?? "";
  if (k.startsWith("K0-")) return KO_RANK.ksX1001;
  if (k.startsWith("K1-")) return KO_RANK.ksX1002;
  return KO_RANK.none;
}

export function oldFormsOf(u: Unihan, x: string): string[] {
  return parseCodepoints(u.kJapaneseOldVariant.get(x)).filter((c) => !isCompatibility(c));
}

function firstValue(map: Map<string, string>, char: string): string | undefined {
  return map.get(char)?.split(" ")[0];
}

// kRSUnicode "85.8" → "85" (간체 부수 표시 ' 는 뗀다)
function radicalOf(u: Unihan, char: string): string | undefined {
  return firstValue(u.kRSUnicode, char)?.split(".")[0].replace(/'/g, "");
}

function variantsOf(u: Unihan, char: string): string[] {
  const glyph = GLYPH_VARIANT_FIELDS.flatMap((f) => parseCodepoints(u[f].get(char)));
  const semantic = parseCodepoints(u.kSemanticVariant.get(char)).filter((c) => radicalOf(u, c) === radicalOf(u, char));
  return [...glyph, ...semantic];
}

export type KoForm = { forms: string[]; diff: KoDiff; basis: KoBasis | null };

// 후보 묶음을 앞에서부터 보고, 한국 표준에 있는 글자가 하나라도 있는 첫 묶음을 고른다.
//   1. 일본 구자체 (円→圓, 予→豫: 신자체 자신이 KS X 1001에 있어도 한국은 구자체를 쓴다)
//   2. 글자 자신 (職·直: 같은 코드포인트)
//   3. Unihan 이체자 연결 (教→敎, 内→內)
//   4. 부수·획수·한국 음이 같은 글자가 딱 하나 (青→靑, 清→淸: Unihan에 연결이 없는 자형 쌍)
// koReadingsOfX는 X 자신의 한국 음(4번 비교용, KANJIDIC2 korean_h + Unihan kHangul)
export function koreanForm(u: Unihan, x: string, koReadingsOfX: string[], twins: TwinIndex): KoForm {
  const old = oldFormsOf(u, x);
  const near = [x, ...old].flatMap((c) => variantsOf(u, c));
  const groups: [KoBasis, string[]][] = [
    ["old", old],
    ["self", [x]],
    ["variant", near],
    ["twin", twins.lookup(u, x, koReadingsOfX)],
  ];
  for (const [basis, cands] of groups) {
    const ranked = [...new Set(cands)]
      .filter((c) => !isCompatibility(c) && koRank(u, c) > 0)
      .sort((a, b) => koRank(u, b) - koRank(u, a));
    if (ranked.length === 0) continue;
    const diff: KoDiff = basis === "self" ? "same" : "form";
    return { forms: ranked, diff, basis };
  }
  return { forms: [], diff: "none", basis: null };
}

// 부수+나머지 획수(kRSUnicode)·총획수·한국 음이 같은 한국 표준 글자. 둘 이상이면 고를 근거가 없어 버린다(柿 → 枾·枲)
export type TwinIndex = { lookup: (u: Unihan, x: string, koReadings: string[]) => string[] };

export function buildTwinIndex(u: Unihan): TwinIndex {
  const byShape = new Map<string, string[]>();
  for (const char of u.kIRG_KSource.keys()) {
    if (koRank(u, char) === 0) continue;
    const key = `${firstValue(u.kRSUnicode, char)}|${firstValue(u.kTotalStrokes, char)}`;
    byShape.set(key, [...(byShape.get(key) ?? []), char]);
  }
  return {
    lookup(un, x, koReadings) {
      const key = `${firstValue(un.kRSUnicode, x)}|${firstValue(un.kTotalStrokes, x)}`;
      const found = (byShape.get(key) ?? []).filter(
        (c) => c !== x && parseHangul(un.kHangul.get(c)).some((r) => koReadings.includes(r)),
      );
      return found.length === 1 ? found : [];
    },
  };
}

// ── 조립 ───────────────────────────────────────────────────────────

export function buildEntry(c: Kanjidic2Char, u: Unihan, twins: TwinIndex): KanjiEntry {
  const x = c.literal;
  const kdKorean = readingsOf(c, "korean_h");
  const ko = koreanForm(u, x, [...new Set([...kdKorean, ...parseHangul(u.kHangul.get(x))])], twins);
  // 한국 음은 고른 한국 자형의 kHangul(한국 표준 순위순). 자형이 없거나 음이 비어 있으면 KANJIDIC2 korean_h
  const koReading = koReadingsOf(ko.forms.map((f) => u.kHangul.get(f)));
  const meanings = c.readingMeaning?.groups.flatMap((g) => g.meanings) ?? [];
  return {
    on: readingsOf(c, "ja_on"),
    kun: readingsOf(c, "ja_kun").map(splitKun),
    koReading: koReading.length > 0 ? koReading : kdKorean,
    ko,
    oldForms: oldFormsOf(u, x),
    meaningsEn: meanings.filter((m) => m.lang === "en").map((m) => m.value),
    grade: c.misc.grade,
    jlptOld: c.misc.jlptLevel,
    strokes: c.misc.strokeCounts,
    freq: c.misc.frequency,
  };
}

// 구자체·한국 자형 → 일본 신자체 역방향 인덱스. 일본 글자 자신(같은 목록 안의 글자)은 키가 되지 않는다
export function buildVariantIndex(entries: Record<string, KanjiEntry>): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const [x, e] of Object.entries(entries)) {
    const from = new Set([...e.oldForms, ...e.ko.forms]);
    for (const v of from) {
      if (v === x || v in entries) continue;
      index[v] = [...new Set([...(index[v] ?? []), x])];
    }
  }
  return Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.codePointAt(0)! - b.codePointAt(0)!));
}
