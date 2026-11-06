// AI ↔ 화면 후리가나 규약: {漢字|かんじ} → ruby. 규약은 .claude/skills/jp-tutor-prompt 참고.
// 스트리밍 중 아직 닫히지 않은 "{…"는 패턴에 안 걸려서 그대로 글자로 남고, 닫히는 순간 ruby로 바뀐다.

export type FuriganaToken =
  | { type: "text"; text: string }
  | { type: "ruby"; base: string; reading: string };

const RUBY = /\{([^|{}]+)\|([^{}]+)\}/g;

export function parseFurigana(source: string): FuriganaToken[] {
  const tokens: FuriganaToken[] = [];
  let last = 0;
  for (const m of source.matchAll(RUBY)) {
    if (m.index > last) tokens.push({ type: "text", text: source.slice(last, m.index) });
    tokens.push({ type: "ruby", base: m[1], reading: m[2] });
    last = m.index + m[0].length;
  }
  if (last < source.length) tokens.push({ type: "text", text: source.slice(last) });
  return tokens;
}
