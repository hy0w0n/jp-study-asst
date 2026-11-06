// 한자 연습장 칸: 정사각 테두리 + 점선 십자 가이드 + 교과서체 한자
type Props = {
  char: string;
  size?: number;
  className?: string;
};

export default function KanjiCell({ char, size = 40, className = "" }: Props) {
  return (
    <span
      lang="ja"
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[6px] border border-line bg-surface font-brush text-ink ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
      <span className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-line" />
      <span className="relative leading-none">{char}</span>
    </span>
  );
}
