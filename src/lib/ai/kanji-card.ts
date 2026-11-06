// 라벨을 모두 갖추고 마지막 줄(예문 → 번역)까지 끝난 응답인지. 잘리거나 형식이 틀린 응답(예: 音読み 라벨)을
// 캐시하지 않으려고 화면과 서버가 같이 쓴다. 기준을 바꾸면 route.ts의 CACHE_VERSION도 올린다.
const REQUIRED = [
  /^\*\*음독\*\*.*\*\*훈독\*\*/m,
  /^\*\*뜻\*\*:/m,
  /^\*\*한국 한자와 차이\*\*:/m,
  /^\*\*자주 쓰는 단어\*\*:/m,
  /^\*\*예문\*\*:[^\n]*→\s*\S/m,
];

export const isCompleteCard = (text: string) => REQUIRED.every((re) => re.test(text));
