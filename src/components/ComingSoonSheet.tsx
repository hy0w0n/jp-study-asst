"use client";

import { useEffect, useRef } from "react";
import type { Feature } from "@/lib/features";
import KanjiCell from "./KanjiCell";

type Props = {
  feature: Feature | null;
  onClose: () => void;
};

// 준비중 기능을 탭했을 때 뜨는 바텀시트. 배경 탭·ESC·[확인]으로 닫힌다.
export default function ComingSoonSheet({ feature, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (feature && !dialog.open) dialog.showModal();
    if (!feature && dialog.open) dialog.close();
  }, [feature]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="coming-soon-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="sheet fixed inset-x-0 bottom-0 top-auto m-0 mx-auto w-full max-w-md rounded-t-2xl bg-surface p-0 text-ink shadow-[0_-8px_24px_rgb(31_27_22/0.08)]"
    >
      {feature && (
        <div className="px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" />
          <KanjiCell char={feature.glyph} size={56} />
          <p className="mt-4 text-sm text-muted">{feature.label}</p>
          <h2 id="coming-soon-title" className="mt-1 text-xl font-bold">
            서비스 준비중입니다
          </h2>
          <p className="mt-2 text-base leading-relaxed text-ink">{feature.pitch}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 h-12 w-full rounded-[14px] bg-accent text-base font-semibold text-white active:opacity-90"
          >
            확인
          </button>
        </div>
      )}
    </dialog>
  );
}
