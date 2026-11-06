---
name: jp-tutor-prompt
description: 앱 안의 AI 생성 규약 — 사전 사실(KANJIDIC2·JMdict)을 주입한 근거 기반(grounded) 프롬프트, 구조화 출력 스키마, 후리가나 표기 규약, Anthropic(AI SDK) 호출 방식, 모델·토큰 설정. AI 설명의 품질·형식·정확도를 만들거나 고칠 때, 새 AI 기능(문법·독해 등)의 프롬프트를 설계할 때 사용.
---

# JP Tutor Prompt (근거 기반 AI 생성)

바뀐 원칙 (해커톤 → v2): AI는 **사전 사실을 받아서** 뜻을 번역하고 단어를 고르고 예문을 쓴다. 읽기·자형 차이·획수는 AI가 말하지 않는다 (`kanji-data`). 결과는 저장 전에 검증한다 (`card-pipeline`).

## 구현 위치
- `src/lib/ai/prompts.ts` — `PROMPT_VERSION`, `BASE_PROMPT`, `kanjiCardPrompt(facts, wordCandidates)`. **프롬프트 수정은 여기서만**, 바꾸면 `PROMPT_VERSION`을 올린다 (카드 캐시 키)
- `src/lib/ai/client.ts` — `@ai-sdk/anthropic` 모델 생성. `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`(학교 프록시, `/v1` 보정), `ANTHROPIC_MODEL ?? "claude-haiku-5-5"`. Haiku 5.5는 기본 adaptive thinking이 출력 상한을 먹으므로 `providerOptions.anthropic.thinking = { type: "disabled" }` 유지 (해커톤에서 확인)
- `src/app/api/kanji/route.ts` — `card-pipeline`의 서빙 순서. AI SDK 7은 설치본 타입·`node_modules/ai` 문서로 API를 확인하고 쓴다 (버전마다 다름)

## 입력: 사전 사실 블록 (서버가 만든다)
```
[사전 사실 — 이 내용과 모순되는 것을 쓰지 않는다]
한자: 学  획수: 8  급수: 소학교 1학년 · JLPT(구) 4
음독: ガク   훈독: まな(ぶ)
한국 한자: 學 (학) — 자형이 다름
영어 뜻: study, learning, science
[단어 후보 — 이 목록 밖의 단어를 만들지 않는다]
1. 学校 がっこう — school
2. 学生 がくせい — student
3. 大学 だいがく — university
... (최대 15개, JMdict 우선순위순)
```

## 출력: 구조화 객체 (zod 스키마 `KanjiCardAi`)
```ts
{
  meaningKo: string,            // 12자 이내 한국어 뜻 (영어 뜻의 번역·요약)
  words: [                      // 정확히 2개, 후보 목록에서 그대로 복사
    { written: string, reading: string, meaningKo: string }
  ],
  example: {                    // 단어 1개를 쓴 20자 이내 일본어 문장
    ja: string,                 // 한자마다 {漢字|よみ} 표기, 가나만 있는 말엔 표기 없음
    ko: string                  // 자연스러운 한국어 번역
  },
  tip?: string                  // 부수·구성으로 외우는 팁 한 줄 (확실하지 않으면 생략)
}
```
- AI SDK의 구조화 출력(`generateObject` / 스트리밍이면 `streamObject`)으로 받는다. 자유 텍스트 파싱은 쓰지 않는다 (해커톤의 형식 통과율 83% 문제의 근본 해결)
- `words[].written/reading`은 서버가 후보 목록과 대조한다. 일치하지 않으면 그 단어를 버리고 1회 재생성 (`card-pipeline` 검증 2)

## BASE_PROMPT (v2)
```
너는 일본 IT 기업 취업을 준비하는 한국인 대학생(JLPT N3~N2)을 돕는 일본어 튜터다.
- 아래 [사전 사실]은 KANJIDIC2·JMdict에서 가져온 정답이다. 읽기·획수·급수·한국 한자 자형은 네가 다시 말하거나 판단하지 않는다.
- 단어는 [단어 후보] 안에서만 고른다. 표기와 읽기를 글자 하나도 바꾸지 않는다. 일상·취업·IT에서 자주 쓰는 것을 우선한다.
- 예문은 고른 단어 하나를 넣은 짧고 자연스러운 현대 일본어 한 문장. 한자가 있으면 반드시 {漢字|よみ} 형식, 가나만 있는 말에는 붙이지 않는다. 중괄호 짝을 맞춘다.
- 한국어 뜻은 짧고 분명하게. 모르면 비워 둔다. 지어내지 않는다.
- 결과는 지정된 JSON 스키마로만 낸다.
```

## 후리가나 규약 (AI ↔ 화면)
- `{漢字|かんじ}` → `<ruby>漢字<rt>かんじ</rt></ruby>` (`src/lib/ai/furigana.ts`). 단어 단위 표기(예: `{学校|がっこう}`)를 허용한다
- 카드 안 한자는 그 글자의 `/kanji/[글자]` 링크 (현재 글자는 링크 없음)
- 검증: 예문의 모든 `\p{Script=Han}` 글자가 중괄호 안에 있어야 한다. 아니면 서버가 표기 보정을 1회 재요청하고, 실패하면 "읽기 표기 일부 누락" 경고와 함께 표시

## 모델·비용
- 기본 Haiku 5.5(thinking off). 품질 비교는 `ai-eval`로 수치를 내고 바꾼다 (느낌으로 바꾸지 않는다)
- 카드가 저장되면 재방문은 AI 0회 (`card-pipeline`). 실시간 생성은 비상용 한자뿐
- 출력 토큰 상한 600. 입력은 후보 15개로 제한

## 향후 모드 (문법·독해·청해·회화)
- 같은 원칙: **결정적 도구를 먼저** 쓰고 AI는 설명만. 독해의 후리가나는 LLM 대신 형태소 분석(kuromoji.js 등)으로 붙이고, AI는 요약·해설 담당 (`research` 스킬로 라이브러리 비교 후 결정)
- 각 모드는 `MODES[mode]`에 `promptVersion`·`schema`·`instruction`을 둔다. 자유 채팅은 넣지 않는다 (범위·비용·정확도 모두 불리)

## 품질 확인 (구현 직후)
- `学 · 職 · 履 · 楽 · 薔`(비상용) 5자: 단어가 후보 안에 있는가, 예문 표기 완전한가, 한국어 뜻이 영어 뜻과 맞는가
- `npm run eval:kanji`(`ai-eval`)로 표본 30자 통과율을 `docs/ACCURACY.md`에 기록
