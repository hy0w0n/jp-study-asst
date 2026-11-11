# evals/

- `kanji-truth.json` — 정답 셋 59자 (KANJIDIC2 3.6.2 · 2026-10-26, CC BY-SA 4.0). 필드: on · kun(`まな.ぶ` 형식, `.` 뒤가 오쿠리가나) · korean_h · korean_r · meanings_en · jlpt_old(구 4단계) · grade · strokes · freq
  - 취업·일상 한자(履歴書·面接·職·就活·開発·情報…) + 자형 차이 까다로운 글자(国·読·売·気·円·図·旧·体·説·青·真·為·即·戸·概·況·温·効)
- `promptfooconfig.example.yaml` — promptfoo로 모델·프롬프트 비교할 때 복사해서 사용
- `results/` — `npm run eval:kanji` 결과 JSON `<날짜(한국 시간)>-<프롬프트 판>-<모델>-<n>x<runs>.json` (git에 남긴다 → 추세가 보인다). 표본 글자(`sample`)·데이터 판(`dataVersion`)이 함께 남는다
  - **기준선**: `2026-11-11-v1-claude-haiku-5-5-30x2.json` (v1 카드, ACCURACY 6장)
- `failures/` — 같은 이름의 `.md`: 결정적 검사 실패 · 판정 3점 이하 · 오류가 난 카드의 사유와 원문 (프롬프트·검증 개선 재료)
- `.cache/` — JMdict 단어 캐시 (kanjiapi.dev, gitignore)

## 실행
```bash
npm run eval:kanji                    # 표본 30자 × 2회 (기본)
npm run eval:kanji -- --n 15 --runs 1 # CI(eval.yml)와 같은 소규모
npm run eval:kanji -- --record        # docs/ACCURACY.md "eval 기록"에 한 줄 추가 (기준선·판 비교를 남길 때만)
npm run eval:kanji -- --sample evals/results/2026-11-11-v1-claude-haiku-5-5-30x2.json  # 기준선과 같은 글자·횟수로 (판 비교는 이것으로)
npm run eval:kanji -- --rescore evals/results/<파일>.json  # 검사 규칙을 고친 뒤 저장된 카드로 결정적 검사만 다시 (API 호출 없음, 데이터 판은 생성 당시 값 유지)
```
- 키는 `.env.local`(로컬) 또는 환경 변수(CI 시크릿) `ANTHROPIC_API_KEY`·`ANTHROPIC_BASE_URL`. 생성 모델은 앱과 같은 `ANTHROPIC_MODEL`(기본 `claude-haiku-5-5`), 판정 모델은 `ANTHROPIC_JUDGE_MODEL`(기본 `claude-opus-5-5`)
- 표본은 정답 셋에 고르게 퍼진 고정 글자다. 정답 셋에 글자를 더하면 표본이 바뀌므로 판끼리는 `--sample`로 같은 글자를 쓴다. 정답 셋은 일부러 어려운 글자(한국 자형이 다른 글자 26/59)를 섞어서, 숫자는 실제 사용 분포보다 나쁘게 나온다
- 카드는 `/api/kanji`와 같은 설정(`src/lib/ai/kanji-generate.ts`)으로 만들고 저장하지 않는다
- 숫자를 믿을 수 없는 실행은 실패(exit 1)로 끝내고 `--record`도 하지 않는다: 생성이 전부 실패 · 판정을 받은 카드가 90% 미만 · JMdict를 받지 못한 카드가 있음
- 시간은 카드 전체 생성 시간(스트리밍 아님, 동시 3, 실패·시간 초과 포함). 판정 평균은 5점에 몰리니 3점 이하 비율을 같이 본다

## 검사
| 종류 | 이름 | 무엇 |
|---|---|---|
| 결정적 (필수) | `format` | 카드 라벨이 모두 있고 잘리지 않음 (`isCompleteCard`) |
| | `on` | 음독이 모두 KANJIDIC2에 있음, 사전에 음독이 있으면 빠뜨리지 않음 |
| | `kun` | 고른 훈독이 KANJIDIC2에 있음 (「-」= 모름은 통과) |
| | `ko-diff` | "한국 한자와 차이"가 Unihan(`kanji.json`)과 맞음 — 자형이 다르면 한국 자형을 말하고, 같으면 다른 자형을 내놓지 않음. 한국 자형 데이터가 없으면 판정 안 함 |
| | `furigana` | 단어·예문의 한자에 모두 `{漢字\|かな}`, 읽기는 가나만, 중괄호 짝 |
| | `words` | 단어가 이 한자를 포함하고 JMdict에 그 표기·읽기로 있음 ("이 한자의 단어"라 포함을 요구한다. 단어 절 자체가 없으면 format에서 센다) |
| 결정적 (참고) | `example-has-char` | 예문에 이 한자가 있음 (v1 프롬프트는 요구하지 않음) |
| | `kun-notation` | 훈독에 기호(うご-く · つか(える))가 없음 — 프롬프트 위반이지만 읽기는 `kun`이 따로 본다 |
| 판정 모델 | `meaning` · `words` · `example` · `translation` | 1~5점: 뜻이 영어 뜻과 맞음 / 단어 뜻이 맞고 자주 쓰는 말 / 예문이 자연스러움 / 번역이 정확함 |

결정적 통과율 = 필수 검사를 모두 통과한 카드 비율. 통과 기준은 `docs/ACCURACY.md` 3장.

자세한 절차는 `.claude/skills/ai-eval/SKILL.md`.
