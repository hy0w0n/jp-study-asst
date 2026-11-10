import { NextResponse, type NextRequest } from "next/server";
import { safeDecode } from "@/lib/kanji/loader";
import { kanjiHref, normalizeToJapanese } from "@/lib/kanji/variants";

// /kanji/學 → /kanji/学?from=學 (308). 획순 데이터에 구자체(樂 15획)가 있어도 일본 페이지(楽 13획)만 보여준다.
// 페이지가 렌더링을 시작한 뒤 redirect()하면 meta 태그로만 이동해서, 렌더링 전인 proxy에서 처리한다.
export function proxy(request: NextRequest) {
  const raw = request.nextUrl.pathname.slice("/kanji/".length);
  // 페이지와 같은 규칙: 주소의 첫 글자만 본다 (src/app/kanji/[char]/page.tsx)
  const char = [...safeDecode(raw)][0] ?? "";
  const hit = normalizeToJapanese(char);
  if (!hit.from) return NextResponse.next();
  return NextResponse.redirect(new URL(kanjiHref(hit), request.url), 308);
}

export const config = {
  matcher: "/kanji/:char",
};
