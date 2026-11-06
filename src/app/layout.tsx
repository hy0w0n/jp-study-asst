import type { Metadata, Viewport } from "next";
import { Klee_One, Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import { Suspense } from "react";
import BottomTabs, { TabBar } from "@/components/BottomTabs";
import "./globals.css";

const notoKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  preload: false,
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  preload: false,
});

const klee = Klee_One({
  variable: "--font-klee",
  weight: ["400", "600"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "SENSE — 한자 획순 선생님",
  description: "모르는 한자를 찾으면 일본식 획순과 AI 설명을 바로 보여줘요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoKr.variable} ${notoJp.variable} ${klee.variable} antialiased`}
    >
      <body>
        <div className="mx-auto flex min-h-dvh max-w-md flex-col pb-[calc(56px+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <Suspense fallback={<TabBar pathname="/kanji/" />}>
          <BottomTabs />
        </Suspense>
      </body>
    </html>
  );
}
