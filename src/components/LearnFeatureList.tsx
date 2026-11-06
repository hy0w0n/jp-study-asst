"use client";

import { useState } from "react";
import { LEARN_FEATURES, type Feature } from "@/lib/features";
import ComingSoonSheet from "./ComingSoonSheet";
import KanjiCell from "./KanjiCell";

export default function LearnFeatureList() {
  const [selected, setSelected] = useState<Feature | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {LEARN_FEATURES.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setSelected(f)}
              className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left active:bg-paper"
            >
              <KanjiCell char={f.glyph} size={48} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-base font-semibold">{f.label}</span>
                  {f.status === "soon" && (
                    <span className="rounded-full border border-muted px-2 py-px text-xs text-muted">
                      준비중
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm leading-snug text-muted">{f.pitch}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ComingSoonSheet feature={selected} onClose={() => setSelected(null)} />
    </>
  );
}
