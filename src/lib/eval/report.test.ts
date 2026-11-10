import { describe, expect, it } from "vitest";
import { appendEvalRow, evalDate, redactError, resultName, spreadSample } from "./report";

const HEADING = "### eval 기록 (ai-eval이 추가)";
const HEADER = "| 날짜 | 통과율 |\n|---|---|";

describe("appendEvalRow", () => {
  it("처음이면 (없음)을 표로 바꾼다", () => {
    const doc = `# 문서\n\n${HEADING}\n(없음)\n`;
    expect(appendEvalRow(doc, HEADING, HEADER, "| v1 | 43% |")).toBe(`# 문서\n\n${HEADING}\n${HEADER}\n| v1 | 43% |\n`);
  });

  it("표 뒤에 해석 문단이 있어도 새 줄은 표 마지막 줄 바로 뒤에 들어간다", () => {
    const doc = `${HEADING}\n${HEADER}\n| v1 | 43% |\n- v1 해석\n`;
    expect(appendEvalRow(doc, HEADING, HEADER, "| v2 | 90% |")).toBe(`${HEADING}\n${HEADER}\n| v1 | 43% |\n| v2 | 90% |\n- v1 해석\n`);
  });

  it("다음 절의 표는 건드리지 않는다", () => {
    const doc = `${HEADING}\n${HEADER}\n| v1 | 43% |\n\n### 다른 절\n| x | y |\n`;
    const out = appendEvalRow(doc, HEADING, HEADER, "| v2 | 90% |");
    expect(out).toContain("| v1 | 43% |\n| v2 | 90% |\n\n### 다른 절\n| x | y |");
  });
});

describe("표본·이름·날짜", () => {
  it("표본은 고르게 퍼진 고정 글자", () => {
    expect(spreadSample(["a", "b", "c", "d", "e", "f"], 3)).toEqual(["a", "c", "e"]);
    expect(spreadSample(["a", "b"], 5)).toEqual(["a", "b"]);
  });

  it("결과 이름에 표본 크기가 들어가 소규모 실행이 기준선을 덮어쓰지 않는다", () => {
    const m = { date: "2026-11-11", promptVersion: "v1", model: "claude-haiku-5-5", runs: 2 };
    expect(resultName({ ...m, n: 30 })).not.toBe(resultName({ ...m, n: 3 }));
    expect(resultName({ ...m, n: 30 })).toBe("2026-11-11-v1-claude-haiku-5-5-30x2");
  });

  it("날짜는 한국 시간 기준 (UTC 2026-11-10 17:00 = 한국 11-11)", () => {
    expect(evalDate(new Date("2026-11-10T17:00:00Z"))).toBe("2026-11-11");
  });

  it("오류 문구의 주소를 지우고 300자로 자른다", () => {
    expect(redactError(new Error("fetch https://proxy.example/v1/messages failed"))).toBe("Error: fetch <url> failed");
    expect(redactError("x".repeat(500))).toHaveLength(300);
  });
});
