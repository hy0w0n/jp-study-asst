---
name: jp-tutor-prompt
description: 앱 안의 AI 생성 규약 — 사전 사실(KANJIDIC2·JMdict)을 주입한 근거 기반(grounded) 프롬프트, 구조화 출력 스키마, 후리가나 표기 규약, Anthropic(AI SDK) 호출 방식, 모델·토큰 설정. AI 설명의 품질·형식·정확도를 만들거나 고칠 때, 새 AI 기능(문법·독해 등)의 프롬프트를 설계할 때 사용.
---

# JP Tutor Prompt (근거 기반 AI 생성)

바뀐 원칙 (해커톤 → v2): AI는 **사전 사실을 받아서** 뜻을 번역하고 단어를 고르고 예문을 쓴다. 읽기·자형 차이·획수는 AI가 말하지 않는다 (`kanji-data`). 결과는 저장 전에 검증한다 (`card-pipeline`).

## 구현 위치
- `src/lib/ai/prompts.ts` — `KANJI_PROMPT_VERSION`(지금 `v2`), `BASE_PROMPT`, `MODES.kanji.instruction(char, 단어 수)`, 사실 블록 `kanjiFacts(char, entry, candidates)`, 재생성 사유 `retryNote`, 검증 판정 루브릭 `CARD_JUDGE_PROMPT`. **프롬프트 수정은 여기서만**, 바꾸면 `KANJI_PROMPT_VERSION`을 올린다 (카드 캐시 키·eval 결과 이름)
- `src/lib/ai/kanji-generate.ts` — `@ai-sdk/anthropic` 모델·요청 설정(`kanjiCardRequest`·`cardJudgeRequest`). `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`(학교 프록시, `/v1` 보정), `ANTHROPIC_MODEL ?? "claude-haiku-5-5"`, 검증 판정 `ANTHROPIC_CARD_JUDGE_MODEL ?? "claude-haiku-5-5"`. Haiku 5.5는 기본 adaptive thinking이 출력 상한을 먹으므로 `providerOptions.anthropic.thinking = { type: "disabled" }` 유지 (해커톤에서 확인). `temperature`는 Haiku 5.5가 받지 않아(무시 경고) 넣지 않는다
- `src/lib/cards/schema.ts`(출력 스키마) · `verify.ts`(검증 6규칙) · `generate.ts`(생성 → 검증 → 판정 → 재생성 1회) — `card-pipeline`. `/api/kanji`와 eval이 같은 `createKanjiCard`를 쓴다
- AI SDK 7은 설치본 타입·`node_modules/ai` 문서로 API를 확인하고 쓴다 (버전마다 다름). 구조화 출력은 `generateText({ output: Output.object({ schema }) })`, 스키마에 맞지 않으면 `NoObjectGeneratedError` → 검증 규칙 1 실패로 보고 재생성

## 입력: 사전 사실 블록 (서버가 만든다)
```
[사전 사실 — 이 내용과 모순되는 것을 쓰지 않는다]
한자: 学
음독: ガク / 훈독: まな(ぶ)
영어 뜻(KANJIDIC2): study, learning, science
한국 한자 음: 학

[단어 후보 — 이 목록 밖의 단어를 만들지 않는다]
1. 学校 がっこう — school
2. 学生 がくせい — student (esp. a university student)
3. 大学 だいがく — university; college
... (최대 15개, src/data/words.json — 순위는 kanji-data 스킬)
```
- 획수·학년·한국 자형은 AI가 쓸 일이 없어 넣지 않는다 (한국 음은 한국어 뜻을 정하는 데 도움이 돼서 넣는다)
- 상용한자가 아니면(kanji.json에 없음) 사실이 없어 카드를 만들지 않는다 → `/api/kanji` 404 `no-data`, 화면에 AI 칸 없음

## 출력: 구조화 객체 (zod 스키마 `KanjiCardAi`)
```ts
{
  meaningKo: string,            // 12자 이내 한국어 뜻 (영어 뜻의 번역·요약)
  words: [                      // 정확히 min(2, 후보 수)개, 후보 목록에서 그대로 복사 (후보 0개면 빈 배열)
    { written: string, reading: string, meaningKo: string }
  ],
  example: {                    // 고른 단어 하나를 쓴 30자 이내 일본어 문장
    ja: string,                 // 한자마다 {漢字|よみ} 표기, 가나·영문·숫자엔 표기 없음
    ko: string                  // 자연스러운 한국어 번역
  }
}
```
- **외우기 팁(tip)은 v2에서 뺐다**: 부수·어원 설명을 검증할 데이터가 없어 지어내기 위험이 크다. 부수 데이터(KRADFILE 등)로 검증할 수 있게 되면 다시 넣는다
- AI SDK 구조화 출력(`generateText` + `Output.object`)으로 받는다. 자유 텍스트 파싱은 쓰지 않는다 (해커톤의 형식 통과율 83% 문제의 근본 해결). **스트리밍하지 않는다** — 검증 전에는 보여줄 수 없다
- 생성 스키마는 모양(타입)만 정한다. 길이·개수·후보 일치는 `verify.ts`가 본다 — 스키마에 넣으면 어긋난 답이 예외로 끝나 사유를 붙인 재생성을 못 한다
- 검증에 떨어지면 떨어진 사유(`words: 「仕事」은 [단어 후보]에 없음` 등)를 프롬프트 끝에 붙여 1회 재생성, 그래도 떨어지면 미노출 (`card-pipeline`)

## BASE_PROMPT (v2)
```
너는 일본 IT 기업 취업을 준비하는 한국인 대학생(JLPT N3~N2)을 돕는 일본어 튜터다.
- 아래 [사전 사실]은 KANJIDIC2·JMdict에서 가져온 정답이다. 읽기·획수·급수·한국 한자 자형은 네가 다시 말하거나 판단하지 않는다.
- 단어는 [단어 후보] 안에서만 고른다. 표기와 읽기를 글자 하나도 바꾸지 않는다. 일상·취업·IT에서 자주 쓰는 것을 우선한다.
- 예문은 고른 단어 하나를 넣은 짧고 자연스러운 현대 일본어 한 문장. 한자가 있으면 반드시 {漢字|よみ} 형식, 가나만 있는 말에는 붙이지 않는다. 중괄호 짝을 맞춘다.
- 한국어 뜻은 짧고 분명하게. 지어내지 않는다.
- 결과는 지정된 JSON 스키마로만 낸다.
```

## 후리가나 규약 (AI ↔ 화면)
- `{漢字|かんじ}` → `<ruby>漢字<rt>かんじ</rt></ruby>` (`src/lib/ai/furigana.ts`). 단어 단위 표기(예: `{学校|がっこう}`)를 허용한다
- 카드 안 한자는 그 글자의 `/kanji/[글자]` 링크 (현재 글자는 링크 없음)
- 단어는 표기·읽기(JMdict)로 화면이 직접 루비를 만든다(`wordFurigana`: 앞뒤 가나는 루비 밖 — {楽|たの}しい)
- 검증(규칙 3): 예문의 모든 `\p{Script=Han}` 글자가 중괄호 안, 읽기는 가나만, 중괄호 짝. 후보 단어(두 글자 이상)를 통째로 묶었으면 읽기가 후보와 같아야 한다. 한 글자 묶음은 비교하지 않는다({楽|たの}しい의 楽 ≠ 후보 楽 らく — 처음 구현의 오탐). 떨어지면 재생성 1회, 그래도 떨어지면 미노출

## 모델·비용
- 기본 Haiku 5.5(thinking off). 품질 비교는 `ai-eval`로 수치를 내고 바꾼다 (느낌으로 바꾸지 않는다)
- 카드가 저장되면 재방문은 AI 0회 (`card-pipeline`). 상용한자 배치 생성(#15) 전까지는 상용한자도 첫 요청에 실시간 생성. 비상용 한자는 만들지 않는다
- 출력 토큰 상한 600. 입력은 후보 15개로 제한 (입력 약 2.2k · 출력 약 0.15k 토큰)
- 실시간 요청도 검증 판정(규칙 5)까지 돈다(사용자 결정 2026-11-11) → 카드 한 장에 모델 호출 2번(생성 + 판정), 재생성이면 최대 4번. 실측 첫 시도 통과 약 4~5초

## 향후 모드 (문법·독해·청해·회화)
- 같은 원칙: **결정적 도구를 먼저** 쓰고 AI는 설명만. 독해의 후리가나는 LLM 대신 형태소 분석(kuromoji.js 등)으로 붙이고, AI는 요약·해설 담당 (`research` 스킬로 라이브러리 비교 후 결정)
- 각 모드는 `MODES[mode]`에 `promptVersion`·`schema`·`instruction`을 둔다. 자유 채팅은 넣지 않는다 (범위·비용·정확도 모두 불리)

## 품질 확인 (구현 직후)
- `学 · 職 · 履 · 楽 · 虎`(후보 1개) 5자: 단어가 후보 안에 있는가, 예문 표기 완전한가, 한국어 뜻이 영어 뜻과 맞는가. `薔`(비상용)은 AI 칸이 없어야 한다
- `npm run eval:kanji`(`ai-eval`)로 표본 30자 통과율을 `docs/ACCURACY.md`에 기록
