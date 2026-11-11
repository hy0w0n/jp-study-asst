// 출처·상태 배지 (designer 스킬). 문구는 docs/ACCURACY.md 1장 표와 같아야 한다.
// 탭하면 짧은 설명 → 정보 화면 링크는 정보 화면(#17)과 함께 붙인다.
export const SOURCE_BADGES = {
  kanjidic2: "사전 · KANJIDIC2",
  unihan: "Unihan",
  jmdict: "JMdict",
} as const;

// AI 카드 상태 (card-pipeline). 화면에는 검증을 통과한 카드만 나온다 — 사람 검수(검수 완료)는 #15 이후
export const CARD_BADGES = {
  auto_verified: "AI 생성 · 자동 검증",
} as const;

export default function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs leading-5 text-muted">
      {children}
    </span>
  );
}
