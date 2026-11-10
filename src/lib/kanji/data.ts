// 사전 데이터(KANJIDIC2 + Unihan) 조회. 데이터는 `npm run data:build`가 src/data/에 만든다 (.claude/skills/kanji-data).
import kanjiFile from "@/data/kanji.json";
import variantsFile from "@/data/variants.json";

// 한국 자형과의 관계. same = 같은 코드포인트(글꼴만 다를 수 있음), form = 다른 글자, none = 한국 표준에 없음
export type KoDiff = "same" | "form" | "none";

// 한국 자형을 어디서 찾았는지 (감사용): old = 일본 구자체, self = 글자 자신,
// variant = Unihan 이체자 연결, twin = 부수·획수·한국 음이 같은 한국 글자 (Unihan에 연결이 없는 자형 쌍)
export type KoBasis = "old" | "self" | "variant" | "twin";

export type Kun = { reading: string; stem: string; okurigana?: string };

export type KanjiEntry = {
  on: string[];
  kun: Kun[];
  koReading: string[];
  ko: { forms: string[]; diff: KoDiff; basis: KoBasis | null };
  oldForms: string[];
  meaningsEn: string[];
  grade: number | null;
  jlptOld: number | null;
  strokes: number[];
  freq: number | null;
};

export type KanjiFile = {
  dataVersion: string;
  sources: { kanjidic2: string; unihan: string };
  kanji: Record<string, KanjiEntry>;
};

export type VariantsFile = {
  dataVersion: string;
  // 구자체·한국 자형 → 일본 신자체 (여러 신자체로 갈 수 있어 배열)
  toJapanese: Record<string, string[]>;
};

const KANJI = kanjiFile as KanjiFile;
const VARIANTS = variantsFile as VariantsFile;

export const DATA_VERSION = KANJI.dataVersion;

export function getKanji(char: string): KanjiEntry | null {
  return KANJI.kanji[char] ?? null;
}

// 구자체·한국 자형이면 일본 신자체 후보를, 아니면 빈 배열을 돌려준다
export function japaneseFormsOf(char: string): string[] {
  return VARIANTS.toJapanese[char] ?? [];
}
