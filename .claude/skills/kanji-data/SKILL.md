---
name: kanji-data
description: 사전 데이터 레이어. 읽기(음독·훈독)·획수·급수·한국 한자 음·한국 한자와의 자형 차이·단어처럼 "정답이 있는 정보"를 KANJIDIC2·JMdict·Unihan에서 가져와 정적 JSON으로 만들고, 구자체/한국 자형 → 일본 신자체 매핑으로 검색을 바로잡을 때 사용. "한자 데이터", "KANJIDIC", "Unihan", "구자체", "한국 한자와 차이", "데이터 파이프라인", "출처 표기" 요청에 사용.
---

# Kanji Data (사전 데이터 레이어)

원칙: **정답이 있는 정보는 AI에게 묻지 않는다.** 읽기·획수·급수·한국 음·자형 차이는 사전 데이터로 보여주고, AI는 뜻 번역·단어 고르기·예문처럼 생성이 필요한 부분만 맡되 그것도 사전 데이터로 검증한다(`jp-tutor-prompt`, `card-pipeline`).
교육용 앱이므로 **출처를 화면에 표기**한다 (심사 피드백: 정확성 검증·출처 표시).

## 데이터 소스 (2026-11 확인)
| 무엇 | 소스 | 필드 | 라이선스 |
|---|---|---|---|
| 한자 기본 (10,384자) | KANJIDIC2 (EDRDG) — `scriptin/jmdict-simplified` GitHub 릴리스의 `kanjidic2-en-<ver>.json.zip` (매주 자동 갱신, 약 1.2MB zip) | `literal` · `readingMeaning.groups[].readings[]` (`type`: `ja_on`, `ja_kun`, `korean_h`, `korean_r`, `pinyin`) · `meanings[].value`(en) · `readingMeaning.nanori` · `misc.grade`(1~6 교육한자, 8 그 외 상용, 9·10 인명용) · `misc.jlptLevel`(**구 4단계**) · `misc.strokeCounts` · `misc.frequency` | CC BY-SA 4.0 (출처 표기 필수) |
| 단어 (JMdict) | 런타임: `https://kanjiapi.dev/v1/words/{字}` (JMdict 항목, `variants[].written/pronounced/priorities`, `meanings[].glosses`) / 빌드: jmdict-simplified의 `jmdict-eng-common-*.json.zip` | | EDRDG 라이선스 (출처 표기) |
| 신자체 ↔ 구자체 | **Unihan 18.0 (2026-09 릴리스)** `Unihan_Variants.txt`의 `kJapaneseOldVariant` / `kJapaneseNewVariant` (provisional, 410쌍) | | Unicode License v3 |
| 한국 표준 자형·음 | Unihan `Unihan_IRGSources.txt`의 `kIRG_KSource`(`K0-` = KS X 1001), `Unihan_Readings.txt`의 `kHangul`(`학:0E` 형식 → `:` 앞만), `Unihan_Variants.txt`의 `kZVariant`·`kSemanticVariant`·`kCompatibilityVariant` | | Unicode License v3 |
| 신 JLPT N1~N5 | KANJIDIC2엔 없음. kanjiapi.dev `jlpt` 필드(Jonathan Waller 목록 기반) 또는 공개 N레벨 목록으로 보충. 화면엔 "(참고)" 표시 | | 출처 표기 |

확인된 샘플 (jmdict-simplified 3.6.2, 2026-10-26): `学` on ガク · kun まな.ぶ · korean_h 학 · grade 1 · 8획 / `職` on ショク・ソク · kun 없음 · korean_h 직 / `楽` korean_h 악 / `薔` grade 없음(비상용) → 데이터 있음.

## 산출물
- `src/data/kanji.json` — 상용한자 2,136자(grade 1~8) + 인명용(선택). 글자 → `{ on: string[], kun: {reading, stem, okurigana?}[], koReading: string[], ko: {form: string|null, diff: "same"|"form"|"none"}, oldForms: string[], meaningsEn: string[], grade, jlptOld, strokes: number[], freq }`
  - `kun`의 `まな.ぶ` → `{reading:"まなぶ", stem:"まな", okurigana:"ぶ"}`, 앞뒤 `-`는 접두/접미 표시로 보존
- `src/data/variants.json` — **역방향 인덱스**: 구자체·한국 자형 → 일본 신자체 (`國→国`, `學→学`, `敎→教`). 검색·라우팅에서 사용
- `src/data/words.json` (선택, 권장) — 상용한자별 상위 15단어 `{written, reading, glossesEn, priority}` (JMdict `priorities`에 `news1`/`ichi1`/`spec1`/`gai1`/`nf0x`가 있는 항목 우선, 2~4글자, 해당 한자 포함)
- `src/data/SOURCES.md` — 출처·라이선스 문구 (앱 '정보' 화면과 카드 배지에서 그대로 사용)
- 원본은 `data-src/`(gitignore)에 내려받고, 빌드 결과만 커밋한다.

## 스크립트 `scripts/build-kanji-data.ts` (`npm run data:build`)
1. **다운로드** (없을 때만): kanjidic2 zip (GitHub 최신 릴리스 — `gh release download`나 releases API), `https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip`, (선택) jmdict-eng-common zip
2. **파싱**: 위 필드만 추출. Unihan 텍스트는 `U+XXXX<TAB>속성<TAB>값` 줄 형식. 값의 `U+XXXX`는 `String.fromCodePoint`로 글자화
3. **한국 한자 차이 알고리즘** (글자 X):
   ```
   old   = kJapaneseOldVariant(X)                       // 구자체들, 없으면 []
   cands = uniq([X, ...old, ...kZVariant(X), ...kSemanticVariant(X), ...kCompatibilityVariant(X), ...old.flatMap(kZVariant)])
   koForm = cands에서 kIRG_KSource가 "K0-"로 시작하는 첫 글자 (X 자신이 K0면 X)   // KS X 1001 = 한국 표준
          ?? "K1-"로 시작하는 첫 글자 (KS X 1002)
          ?? null
   diff  = koForm === null ? "none" : koForm === X ? "same" : "form"
   koReading = kHangul(koForm) (여러 개면 모두; "학:0E" → "학")  // 없으면 KANJIDIC2 korean_h
   ```
   기대 결과 (vitest로 고정): `学→學 form 학` · `職→職 same 직` · `教→敎 form 교` · `楽→樂 form 악·락` · `直→直 same 직`(글꼴만 다름) · `青→靑` · `真→眞` · `国→國` · `読→讀` · `売→賣` · `気→氣` · `円→圓` · `図→圖`
   - 같은 코드포인트지만 글꼴 모양이 다른 글자(直·骨·角·令 등)는 "same"이고, 화면에서 `lang="ja"`/`lang="ko"` 두 글꼴로 나란히 보여준다 (`designer`)
4. **역방향 인덱스**: 모든 X에 대해 `old`와 `koForm`(X와 다르면) → X. 충돌(한 구자체가 두 신자체로 가는 경우: 예 `辨·瓣·辯→弁`)은 배열로 두고 UI에서 고르게 한다
5. **검증 후 쓰기**: 글자 수(2,136), 샘플 13개 일치, 빈 읽기 비율 보고. 실패하면 파일을 쓰지 않는다
6. `src/data/SOURCES.md` 갱신 (버전·날짜 포함)

## 런타임 API `src/lib/kanji/data.ts`
- `getKanji(char)`: `kanji.json` → 없으면 kanjidic 전체(빌드 시 `kanji-all.json`, 약 10k자, 기본 필드만) → 없으면 `null`
- `normalizeToJapanese(char)`: `variants.json`으로 구자체·한국 자형을 신자체로. 배열이면 후보 반환
- 라우팅: `/kanji/國` → `/kanji/国`로 redirect(308) + 배너 "한국·구자체 國 → 일본 国" (검색 결과 칩도 같은 규칙; 칩에 작은 `→国` 표시)
- 획순 데이터(`hanzi-writer-data-jp`)에 구자체(樂 15획)가 있어도 **일본 페이지(楽 13획)만** 보여준다 (TASKS L3①)

## 출처 표기 규칙
- 사전 섹션 제목 옆 배지: `사전 · KANJIDIC2` / 단어: `JMdict` / 차이: `Unihan`
- 앱 '정보' 화면: `SOURCES.md` 내용 (EDRDG 문구, Unicode License, hanzi-writer-data-jp 문구)
- README 라이선스 절에도 동일

## 갱신
- jmdict-simplified는 매주 월요일 릴리스. `.github/workflows/data-refresh.yml`(월 1회)이 `npm run data:build` 후 변경이 있으면 PR을 연다. Unihan은 연 1회(9월)
- 데이터 버전(`dataVersion`)은 `kanji.json` 상단에 기록하고 카드 캐시 무효화에 쓴다 (`card-pipeline`)

## 완료 기준
- `npm run data:build` 성공, vitest `data.test.ts`(샘플 13개 + 역방향 3개) 통과
- `/kanji/学` 사전 섹션에 ガク · まな(ぶ) · 학 · 8획 · 소학교 1학년 · 한국 한자 學 표시, 출처 배지 보임
- `/kanji/學`·`/kanji/國` → 신자체로 이동 + 배너
