// 확장 예정 기능 목록. 완성되면 status만 'live'로 바꾼다. 준비중은 4개(문법·독해·청해·회화).
export type Feature = {
  id: string;
  label: string;
  /** 아이콘 칸에 들어갈 한자 한 글자 */
  glyph: string;
  status: "live" | "soon";
  /** 이 기능이 해 줄 일 한 줄 (준비중 시트에 표시) */
  pitch: string;
};

export const LEARN_FEATURES: Feature[] = [
  {
    id: "grammar",
    label: "문법",
    glyph: "文",
    status: "soon",
    pitch: "N3~N2 문법을 예문으로 익혀요.",
  },
  {
    id: "reading",
    label: "독해",
    glyph: "読",
    status: "soon",
    pitch: "다양한 글을 읽고 내용을 파악해요.",
  },
  {
    id: "listening",
    label: "청해",
    glyph: "聴",
    status: "soon",
    pitch: "일상생활, 뉴스, 인터뷰 질문 등을 알아들을 수 있어요.",
  },
  {
    id: "speaking",
    label: "회화",
    glyph: "話",
    status: "soon",
    pitch: "질문에 대답하고 생각을 전달할 수 있어요.",
  },
];
