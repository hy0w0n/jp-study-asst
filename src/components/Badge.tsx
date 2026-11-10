// 출처·상태 배지 (designer 스킬). 문구는 docs/ACCURACY.md 1장 표와 같아야 한다.
// 탭하면 짧은 설명 → 정보 화면 링크는 정보 화면(#17)과 함께 붙인다.
export const SOURCE_BADGES = {
  kanjidic2: "사전 · KANJIDIC2",
  unihan: "Unihan",
} as const;

export default function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs leading-5 text-muted">
      {children}
    </span>
  );
}
