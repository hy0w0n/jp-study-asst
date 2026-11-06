// 훅 공통: stdin의 JSON에서 점 표기 경로의 값을 꺼낸다. 예) node _json.js tool_input.file_path
// jq가 없는 Windows(Git Bash)에서도 동작하도록 Node만 쓴다.
let s = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (s += d));
process.stdin.on("end", () => {
  let v = "";
  try {
    const j = JSON.parse(s || "{}");
    v = (process.argv[2] || "").split(".").reduce((o, k) => (o == null ? undefined : o[k]), j);
  } catch {
    v = "";
  }
  if (v === undefined || v === null) v = "";
  process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
});
