// 확장 예정 기능 목록. 완성되면 status만 'live'로 바꾼다. 준비중은 최대 3개.
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
    pitch: "N3~N2 문법을 면접·메일 예문으로 익혀요.",
  },
  {
    id: "reading",
    label: "독해",
    glyph: "読",
    status: "soon",
    pitch: "일본 IT 기업 채용 공고와 메일을 읽고 핵심을 짚어 줘요.",
  },
  {
    id: "listening",
    label: "청해",
    glyph: "聴",
    status: "soon",
    pitch: "면접 질문을 듣고 받아쓰며 귀를 길러요.",
  },
];
