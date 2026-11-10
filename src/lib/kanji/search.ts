// 입력에서 한자·가나만 뽑는다 (중복 제거, 순서 유지)
export function extractChars(text: string): string[] {
  const found = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [];
  return [...new Set(found)];
}
