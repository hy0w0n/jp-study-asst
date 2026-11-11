// 상용한자별 JMdict 단어 후보 (words.json, `npm run data:build`). AI 카드는 이 목록 안에서만 단어를 고르고,
// 서버 검증(src/lib/cards/verify.ts)이 표기·읽기를 이 목록과 대조한다. 서버에서만 쓴다
import "server-only";
import wordsFile from "@/data/words.json";
import type { WordCandidate } from "./build-data";

export type WordsFile = {
  dataVersion: string;
  words: Record<string, WordCandidate[]>;
};

// JSON은 튜플을 string[]로 추론하므로 unknown을 거친다 (모양은 data:build가 보장)
const WORDS = wordsFile as unknown as WordsFile;

export const WORDS_VERSION = WORDS.dataVersion;

// 사용자 입력이 그대로 들어오므로 "constructor" 같은 프로토타입 키를 거른다
export function getWordCandidates(char: string): WordCandidate[] {
  return Object.hasOwn(WORDS.words, char) ? WORDS.words[char] : [];
}
