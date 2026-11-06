// 일본식 획순 데이터 로더 (@k1low/hanzi-writer-data-jp). 글자당 JSON 1개, 히라가나·가타카나 포함.
import type { CharacterJson } from "hanzi-writer";

export type CharData = CharacterJson;

const SOURCES = [
  "https://cdn.jsdelivr.net/npm/@k1low/hanzi-writer-data-jp@0.8.0/",
  "https://unpkg.com/@k1low/hanzi-writer-data-jp@0.8.0/",
];

const cache = new Map<string, Promise<CharData | null>>();

async function fetchFromSources(char: string): Promise<CharData | null> {
  const file = `${encodeURIComponent(char)}.json`;
  for (const base of SOURCES) {
    try {
      const res = await fetch(base + file);
      if (res.ok) return (await res.json()) as CharData;
    } catch {
      // 네트워크 오류면 다음 소스로
    }
  }
  return null;
}

/** 데이터가 없는 글자(薔 등)는 null. 같은 글자는 한 번만 요청한다. */
export function loadCharData(char: string): Promise<CharData | null> {
  let p = cache.get(char);
  if (!p) {
    p = fetchFromSources(char);
    cache.set(char, p);
  }
  return p;
}

export const isKanji = (s: string) => /\p{Script=Han}/u.test(s);
export const isKana = (s: string) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);

/** 라우트 파라미터가 인코딩된 채로 와도(%E8%81%B7) 글자로 되돌린다. */
export function safeDecode(s: string): string {
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
