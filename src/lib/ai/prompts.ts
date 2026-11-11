// 앱 내부 AI 프롬프트는 이 파일 한 곳에서만 고친다. 규약: .claude/skills/jp-tutor-prompt
// 오늘은 kanji 모드만 쓴다. 나머지 모드(word·grammar·correct·interview·free)는 범위가 바뀔 때 추가.
import type { WordCandidate } from "../kanji/build-data";
import type { KanjiEntry } from "../kanji/data";

// v2: 읽기·자형은 사전 데이터가 보여 주고, AI는 사전 사실을 받아 뜻·단어 선택·예문만 쓴다 (정확도 원칙 1·2)
export const BASE_PROMPT = `너는 일본 IT 기업 취업을 준비하는 한국인 대학생(JLPT N3~N2)을 돕는 일본어 튜터다.
- 아래 [사전 사실]은 KANJIDIC2·JMdict에서 가져온 정답이다. 읽기·획수·급수·한국 한자 자형은 네가 다시 말하거나 판단하지 않는다.
- 단어는 [단어 후보] 안에서만 고른다. 표기와 읽기를 글자 하나도 바꾸지 않는다. 일상·취업·IT에서 자주 쓰는 것을 우선한다.
- 예문은 고른 단어 하나를 넣은 짧고 자연스러운 현대 일본어 한 문장. 한자가 있으면 반드시 {漢字|よみ} 형식, 가나만 있는 말에는 붙이지 않는다. 중괄호 짝을 맞춘다.
- 한국어 뜻은 짧고 분명하게. 지어내지 않는다.
- 결과는 지정된 JSON 스키마로만 낸다.`;

// kanji 모드 프롬프트 판. 문구·형식을 바꾸면 올린다 — eval 결과 파일 이름·ACCURACY 기록·카드 캐시 키가 이 값으로 갈린다
export const KANJI_PROMPT_VERSION = "v2";

// 고를 단어 수: 후보가 적은 글자(璽·朕 0개, 虎 1개)는 후보 수만큼
export const wordCount = (candidates: WordCandidate[]) => Math.min(2, candidates.length);

export const MODES = {
  // 한자 상세 카드: 사용자 입력 없이 글자만 받아 자동 요청. 출력 모양은 src/lib/cards/schema.ts
  kanji: {
    maxOutputTokens: 600,
    instruction: (char: string, words: number) => `한 글자 한자 ${char}의 학습 카드를 JSON 필드로 채운다.
- meaningKo: ${char}의 한국어 뜻. [사전 사실]의 영어 뜻을 바탕으로 짧은 한국어 1~3개를 쉼표로 (12자 이내, 예: "배우다, 학문")
- words: ${
      words === 0
        ? "[단어 후보]가 없으므로 빈 배열"
        : `[단어 후보]에서 정확히 ${words}개. written·reading은 후보를 그대로 복사하고, meaningKo에 그 단어의 한국어 뜻을 짧게 쓴다`
    }
- example.ja: ${words === 0 ? `${char}가 들어간` : "고른 단어 하나를 넣은"} 짧고 자연스러운 현대 일본어 한 문장 (30자 이내). 한자는 빠짐없이 {漢字|よみ}로 히라가나 읽기를 붙인다. 단어 단위로 묶어도 된다({学校|がっこう}). 오쿠리가나는 중괄호 밖에 쓴다({学|まな}ぶ). 한자가 아닌 말(가나·영문·숫자)에는 붙이지 않는다
- example.ko: 예문의 자연스러운 한국어 번역
- 한국어 칸(meaningKo·example.ko)에는 일본어 가나, 읽기(음독·훈독), 자형(신자체·구자체) 이야기를 쓰지 않는다`,
  },
} as const;

export type Mode = keyof typeof MODES;

// 사전 사실 블록 — 서버가 kanji.json·words.json으로 만든다. AI는 이 내용과 모순되는 것을 쓰지 않는다
export function kanjiFacts(char: string, entry: KanjiEntry, candidates: WordCandidate[]): string {
  const kun = entry.kun.map((k) => (k.okurigana ? `${k.stem}(${k.okurigana})` : k.stem));
  return [
    "[사전 사실 — 이 내용과 모순되는 것을 쓰지 않는다]",
    `한자: ${char}`,
    `음독: ${entry.on.join("、") || "없음"} / 훈독: ${kun.join("、") || "없음"}`,
    `영어 뜻(KANJIDIC2): ${entry.meaningsEn.join(", ")}`,
    ...(entry.ko.diff !== "none" && entry.koReading.length > 0 ? [`한국 한자 음: ${entry.koReading.join(", ")}`] : []),
    "",
    "[단어 후보 — 이 목록 밖의 단어를 만들지 않는다]",
    ...(candidates.length > 0
      ? candidates.map(([written, reading, gloss], i) => `${i + 1}. ${written} ${reading} — ${gloss}`)
      : ["(없음)"]),
  ].join("\n");
}

// 검증에 떨어진 답을 한 번 다시 만들 때 붙인다 (src/lib/cards/generate.ts)
export const retryNote = (problems: string[]) =>
  `\n\n[이전 답의 문제 — 고쳐서 다시 낸다]\n${problems.map((p) => `- ${p}`).join("\n")}`;

// 검증 규칙 5: 판정 모델 루브릭. 실시간 카드도 저장·노출 전에 이 판정을 통과해야 한다 (사용자 결정 2026-11-11)
export const CARD_JUDGE_PROMPT = `너는 한국인 일본어 학습자(JLPT N3~N2)용 한자 카드를 검수한다.
주어진 사전 사실(KANJIDIC2 영어 뜻, JMdict 단어 뜻)을 기준으로 세 항목을 각각 1~5점(정수)으로 채점하고 한 줄 이유를 한국어로 쓴다.
5 = 정확하고 자연스럽다 · 4 = 사소한 흠 · 3 = 쓸 만하지만 고칠 점이 있다 · 2 = 틀린 부분이 있다 · 1 = 틀렸다
- meaning: 한자의 한국어 뜻(meaningKo)이 영어 뜻과 맞는가
- words: 각 단어의 한국어 뜻이 그 단어의 JMdict 영어 뜻과 맞는가 (단어가 없으면 5점)
- translation: 예문의 한국어 번역(example.ko)이 일본어 예문(example.ja)과 같은 뜻인가
읽기·후리가나·단어 표기는 코드로 따로 검사하므로 점수에 넣지 않는다.`;
