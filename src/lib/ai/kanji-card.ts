// 마지막 줄(예문 → 번역)까지 끝난 응답인지. 토큰 상한에서 잘린 응답을 캐시하지 않으려고 화면과 서버가 같이 쓴다.
export const isCompleteCard = (text: string) => /\*\*예문\*\*:[^\n]*→\s*\S/.test(text);
