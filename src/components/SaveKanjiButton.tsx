"use client";

import { useState } from "react";
import type { Feature } from "@/lib/features";
import ComingSoonSheet from "./ComingSoonSheet";

// 내 한자장(Tier 2 S3) 전까지는 준비중 시트만 띄운다. LEARN_FEATURES(준비중 3개 고정)와는 별개.
const MY_KANJI: Feature = {
  id: "my-kanji",
  label: "내 한자장",
  glyph: "記",
  status: "soon",
  pitch: "외울 한자를 모아 두고 따라 쓰기로 복습해요.",
};

export default function SaveKanjiButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-accent bg-surface text-base font-semibold text-accent active:bg-accent-soft"
      >
        <span aria-hidden>☆</span>
        외울 한자로 등록
      </button>
      <ComingSoonSheet feature={open ? MY_KANJI : null} onClose={() => setOpen(false)} />
    </>
  );
}
