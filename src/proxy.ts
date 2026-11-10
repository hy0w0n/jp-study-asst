import { NextResponse, type NextRequest } from "next/server";
import { charFromParam } from "@/lib/kanji/loader";
import { kanjiHref, normalizeToJapanese } from "@/lib/kanji/variants";

// /kanji/學 → /kanji/学?from=學 (307). 획순 데이터에 구자체(樂 15획)가 있어도 일본 페이지(楽 13획)만 보여준다.
// 페이지가 렌더링을 시작한 뒤 redirect()하면 meta 태그로만 이동해서, 렌더링 전인 proxy에서 처리한다.
// 308이 아닌 307: 매핑은 데이터(variants.json)라 갱신 때 바뀔 수 있는데, 308은 브라우저가 영구히 캐시한다.
export function proxy(request: NextRequest) {
  const hit = normalizeToJapanese(charFromParam(request.nextUrl.pathname.slice("/kanji/".length)));
  if (!hit.from) return NextResponse.next();
  return NextResponse.redirect(new URL(kanjiHref(hit), request.url), 307);
}

export const config = {
  matcher: "/kanji/:char",
};
