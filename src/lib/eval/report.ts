// eval:kanji 결과를 남기는 순수 함수들 (scripts/eval-kanji.ts가 쓰고, 여기서 테스트한다)

// 표본은 정답 셋 전체에 고르게 퍼진 고정 글자. 정답 셋에 글자를 더하면 표본이 바뀌므로,
// 판끼리 비교할 때는 결과 파일에 남긴 표본(--sample)을 다시 쓴다
export function spreadSample<T>(items: T[], n: number): T[] {
  if (n >= items.length) return items;
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)]);
}

// 실행한 기계의 시간대와 상관없이 같은 날짜가 나오게 한국 시간으로 (CI 러너는 UTC)
export const evalDate = (now = new Date()) => now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

// 결과 파일 이름. 표본 크기를 넣어 소규모 실행이 기준선 파일을 덮어쓰지 않게 한다
export const resultName = (m: { date: string; promptVersion: string; model: string; n: number; runs: number }) =>
  `${m.date}-${m.promptVersion}-${m.model}-${m.n}x${m.runs}`;

// 결과 파일은 git에 남는다 — 오류 문구의 주소·긴 응답 본문은 지운다
export function redactError(error: unknown): string {
  return String(error)
    .replace(/https?:\/\/\S+/g, "<url>")
    .slice(0, 300);
}

// ACCURACY.md의 eval 기록 절에서 표의 마지막 줄 바로 뒤에 한 줄을 넣는다.
// 표가 없으면("(없음)") 머리와 함께 만든다. 표 뒤에 붙은 해석 문단은 그대로 표 아래에 남는다
export function appendEvalRow(doc: string, heading: string, header: string, row: string): string {
  const start = doc.indexOf(heading);
  if (start < 0) throw new Error(`"${heading}" 절이 없습니다`);
  const sectionStart = start + heading.length;
  const nextHeading = doc.slice(sectionStart).search(/\n#{1,3} /);
  const sectionEnd = nextHeading < 0 ? doc.length : sectionStart + nextHeading;
  const section = doc.slice(sectionStart, sectionEnd);

  let updated: string;
  if (section.includes("(없음)")) {
    updated = section.replace("(없음)", `${header}\n${row}`);
  } else {
    const lines = section.split("\n");
    const last = lines.findLastIndex((l) => l.startsWith("|"));
    if (last < 0) throw new Error(`"${heading}" 절에 표가 없습니다`);
    lines.splice(last + 1, 0, row);
    updated = lines.join("\n");
  }
  return doc.slice(0, sectionStart) + updated + doc.slice(sectionEnd);
}
