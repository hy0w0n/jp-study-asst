"use client";

import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";

// 홈에서 로고를 누르면 같은 주소로 다시 이동하는 대신 맨 위로 (새 탭 열기 등 보조 키 클릭은 그대로)
function scrollTopOnHome(e: MouseEvent<HTMLAnchorElement>) {
  if (window.location.pathname !== "/" || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

// 모든 화면 공통 헤더 (designer 스킬): 로고 + 워드마크가 하나의 홈 링크
export default function AppHeader() {
  return (
    <header className="px-5 pt-[calc(8px+env(safe-area-inset-top))]">
      <Link
        href="/"
        onClick={scrollTopOnHome}
        aria-label="SENSE 홈으로"
        className="-ml-2 inline-flex h-11 items-center gap-2 rounded-[14px] px-2 active:bg-accent-soft"
      >
        <Image src="/logo.png" alt="" width={32} height={32} priority className="mix-blend-multiply" />
        <ruby className="font-brush text-lg font-semibold tracking-[0.08em] text-ink">
          SENSE<rt lang="ja" className="tracking-normal">センセ</rt>
        </ruby>
      </Link>
    </header>
  );
}
