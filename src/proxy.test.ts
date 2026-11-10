import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const run = (path: string) => proxy(new NextRequest(`http://localhost${path}`));
const location = (path: string) => {
  const res = run(path);
  expect(res.status).toBe(307);
  const url = new URL(res.headers.get("location")!);
  return decodeURIComponent(url.pathname + url.search);
};
// NextResponse.next()는 이 헤더로 "그대로 진행"을 표시한다
const passes = (path: string) => expect(run(path).headers.get("x-middleware-next")).toBe("1");

describe("proxy (/kanji/[char] 자형 정규화)", () => {
  it("인코딩된 한국 자형을 신자체로 보낸다 (대·소문자 인코딩 모두)", () => {
    expect(location("/kanji/%E5%AD%B8")).toBe("/kanji/学?from=學");
    expect(location("/kanji/%e5%ad%b8")).toBe("/kanji/学?from=學");
  });

  it("페이지와 같이 첫 글자만 본다 (學校 → 学)", () => {
    expect(location(`/kanji/${encodeURIComponent("學校")}`)).toBe("/kanji/学?from=學");
  });

  it("기존 쿼리는 버리고 from을 새로 단다", () => {
    expect(location(`/kanji/${encodeURIComponent("國")}?from=x`)).toBe("/kanji/国?from=國");
  });

  it("신자체·깨진 인코딩·빈 주소는 그대로 둔다", () => {
    passes(`/kanji/${encodeURIComponent("学")}`);
    passes("/kanji/%E5");
    passes("/kanji/");
  });
});
