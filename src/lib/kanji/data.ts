// 사전 데이터(KANJIDIC2 + Unihan) 조회. 데이터는 `npm run data:build`가 src/data/에 만든다 (.claude/skills/kanji-data).
// kanji.json은 약 690KB라 서버에서만 쓴다. 클라이언트에서 쓸 자형 정규화는 ./variants
import "server-only";
import kanjiFile from "@/data/kanji.json";

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

const KANJI = kanjiFile as KanjiFile;

export const DATA_VERSION = KANJI.dataVersion;

// 사용자 입력이 그대로 들어오므로 "constructor" 같은 프로토타입 키를 거른다
export function getKanji(char: string): KanjiEntry | null {
  return Object.hasOwn(KANJI.kanji, char) ? KANJI.kanji[char] : null;
}
