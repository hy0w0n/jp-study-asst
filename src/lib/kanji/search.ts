import { normalizeToJapanese, type Normalized } from "./variants";

// 입력에서 한자·가나만 뽑는다 (중복 제거, 순서 유지)
export function extractChars(text: string): string[] {
  const found = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [];
  return [...new Set(found)];
}

// 검색 결과: 뽑은 글자를 일본 신자체로 바꾼 뒤 다시 중복을 지운다 (學学 → 学 하나, 처음 나온 쪽의 from을 남긴다).
// 신자체를 먼저 직접 쳤다면(学學) 이미 일본 자형을 아는 것이라 from을 붙이지 않는다 (배너 없음)
export function searchHits(text: string): Normalized[] {
  const hits = new Map<string, Normalized>();
  for (const ch of extractChars(text)) {
    const hit = normalizeToJapanese(ch);
    if (!hits.has(hit.char)) hits.set(hit.char, hit);
  }
  return [...hits.values()];
}
