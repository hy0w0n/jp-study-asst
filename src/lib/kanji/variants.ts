// 구자체·한국 자형 → 일본 신자체 (variants.json, 약 7KB). kanji.json과 달리 클라이언트(검색창)에서도 쓴다.
import variantsFile from "@/data/variants.json";

export type VariantsFile = {
  dataVersion: string;
  // 구자체·한국 자형 → 일본 신자체 (여러 신자체로 갈 수 있어 배열)
  toJapanese: Record<string, string[]>;
};

const VARIANTS = variantsFile as VariantsFile;

// 구자체·한국 자형이면 일본 신자체 후보를, 아니면 빈 배열을 돌려준다
// 사용자 입력이 그대로 들어오므로 "constructor" 같은 프로토타입 키를 거른다
export function japaneseFormsOf(char: string): string[] {
  return Object.hasOwn(VARIANTS.toJapanese, char) ? VARIANTS.toJapanese[char] : [];
}

// from이 있으면 char는 from을 바꾼 일본 신자체다 (學 → { char: 学, from: 學 })
export type Normalized = { char: string; from?: string };

// 신자체가 하나로 정해질 때만 바꾼다. 여럿이면 고를 근거가 없으니 그대로 둔다 (현재 데이터엔 없음, variants.test.ts)
export function normalizeToJapanese(char: string): Normalized {
  const forms = japaneseFormsOf(char);
  return forms.length === 1 ? { char: forms[0], from: char } : { char };
}

// /kanji/学?from=學 — 바꾼 글자면 원래 글자를 붙여 한자 페이지가 안내 배너를 띄운다
export function kanjiHref({ char, from }: Normalized): string {
  const path = `/kanji/${encodeURIComponent(char)}`;
  return from ? `${path}?from=${encodeURIComponent(from)}` : path;
}
