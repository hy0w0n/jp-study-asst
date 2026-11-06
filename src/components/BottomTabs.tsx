"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "한자", icon: KanjiIcon },
  { href: "/learn", label: "학습", icon: NoteIcon },
] as const;

export default function BottomTabs() {
  return <TabBar pathname={usePathname()} />;
}

// /kanji/[char]처럼 주소를 런타임에만 아는 페이지는 layout의 Suspense fallback으로 이걸 먼저 그린다
export function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex h-14 max-w-md">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" || pathname.startsWith("/kanji/") : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[13px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function KanjiIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M8 8.5h8M12 6.5v11M8.5 15l3.5-3.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6M9 11h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
