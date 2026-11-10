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
| 신자체 ↔ 구자체 | **Unihan 18.0 (2026-09 릴리스)** `Unihan_Variants.txt`의 `kJapaneseOldVariant` (provisional, 363자) | | Unicode License v3 |
| 한국 표준 자형·음 | Unihan `Unihan_IRGSources.txt`의 `kIRG_KSource`(`K0-` = KS X 1001, `K1-` = KS X 1002)·`kRSUnicode`·`kTotalStrokes`, `Unihan_OtherMappings.txt`의 `kKoreanEducationHanja`(교육용 기초한자 1,800자), `Unihan_Readings.txt`의 `kHangul`(`학:0E` 형식 → `:` 앞만), `Unihan_Variants.txt`의 `kZVariant`·`kCompatibilityVariant`·`kTraditionalVariant`·`kSimplifiedVariant`·`kSemanticVariant` | | Unicode License v3 (고지 전문을 SOURCES.md에 포함) |
| 신 JLPT N1~N5 | KANJIDIC2엔 없음. kanjiapi.dev `jlpt` 필드(Jonathan Waller 목록 기반) 또는 공개 N레벨 목록으로 보충. 화면엔 "(참고)" 표시 | | 출처 표기 |

확인된 샘플 (jmdict-simplified 3.6.2, 2026-10-26): `学` on ガク · kun まな.ぶ · korean_h 학 · grade 1 · 8획 / `職` on ショク・ソク · kun 없음 · korean_h 직 / `楽` korean_h 악 / `薔` grade 없음(비상용) → 데이터 있음.

## 산출물
- `src/data/kanji.json` — `{ dataVersion, sources, kanji }`. `kanji`는 상용한자 2,136자(grade 1~8), 글자 → `{ on: string[], kun: {reading, stem, okurigana?}[], koReading: string[], ko: {forms: string[], diff: "same"|"form"|"none", basis: "old"|"self"|"variant"|"twin"|null}, oldForms: string[], meaningsEn: string[], grade, jlptOld, strokes: number[], freq }` (타입: `src/lib/kanji/data.ts`)
  - `kun`의 `まな.ぶ` → `{reading:"まなぶ", stem:"まな", okurigana:"ぶ"}`, 앞뒤 `-`는 접두/접미 표시로 보존
  - `ko.forms`는 여러 개일 수 있다(`弁 → 辨·辯·瓣`). `basis`는 감사용 근거(아래 알고리즘 단계)
  - 한 줄에 글자 하나로 써서 데이터 갱신 PR의 diff를 읽기 쉽게 한다. 빌드 시각은 넣지 않는다(원본이 같으면 결과도 같게)
- `src/data/variants.json` — `{ dataVersion, toJapanese }`. **역방향 인덱스**: 구자체·한국 자형 → 일본 신자체 배열 (`國→[国]`, `學→[学]`, `敎→[教]`). 검색·라우팅에서 사용
- `src/data/words.json` (아직 없음 — 0-6에서 필요한 만큼) — 상용한자별 상위 15단어 `{written, reading, glossesEn, priority}` (JMdict `priorities`에 `news1`/`ichi1`/`spec1`/`gai1`/`nf0x`가 있는 항목 우선, 2~4글자, 해당 한자 포함)
- `src/data/SOURCES.md` — 출처·라이선스 문구 (앱 '정보' 화면과 카드 배지에서 그대로 사용)
- 원본은 `data-src/`(gitignore)에 내려받고, 빌드 결과만 커밋한다.

## 스크립트 `scripts/build-kanji-data.ts` (`npm run data:build`)
순수 변환은 `src/lib/kanji/build-data.ts`(vitest 대상), 다운로드·쓰기는 스크립트. zip 해제는 `fflate`.
1. **다운로드** (없을 때만, `data-src/`): kanjidic2 zip (GitHub releases API로 최신 릴리스 — 닿지 못하면 내려받아 둔 최신 파일), `Unihan.zip` 18.0.0, `unicode.org/license.txt`
2. **파싱**: 위 필드만 추출. Unihan 텍스트는 `U+XXXX<TAB>속성<TAB>값` 줄 형식. 값의 `U+XXXX<kLau,...`는 꺾쇠 뒤를 버리고 `String.fromCodePoint`로 글자화
3. **한국 자형 알고리즘** (글자 X) — 후보 묶음을 차례로 보고, 한국 표준 글자가 하나라도 있는 **첫 묶음**의 글자를 모두 고른다
   ```
   한국 표준 순위: 교육용 기초한자(kKoreanEducationHanja) 3 > KS X 1001(K0) 2 > KS X 1002(K1) 1 > 없음 0
   CJK 호환 한자(NFC로 X가 되는 欄 U+F91D 등)는 어느 묶음에서도 뺀다
   1. old     = kJapaneseOldVariant(X)          // 円→圓, 予→豫: 신자체 자신이 KS X 1001에 있어도(円=엔) 한국은 구자체를 쓴다
   2. self    = [X]                             → diff "same" (職·直)
   3. variant = X와 old의 kZVariant·kCompatibilityVariant·kTraditionalVariant·kSimplifiedVariant
                + kSemanticVariant 중 부수(kRSUnicode)가 같은 것   // 教→敎, 内→內. 咲→笑(부수 다름)는 다른 글자라 제외
                (kSpecializedSemanticVariant는 뜻이 일부만 겹쳐서 쓰지 않는다: 丼→井 제외)
   4. twin    = kRSUnicode·kTotalStrokes·한국 음이 X와 같은 한국 표준 글자가 **딱 하나**일 때   // 青→靑, 清→淸, 尚→尙 (Unihan에 연결 없음)
                둘 이상이면 고르지 않는다 (柿 → 枾·枲)
   forms = 고른 묶음에서 순위 > 0인 글자를 순위순으로, 없으면 [] · diff = self면 "same", 다른 묶음이면 "form", 없으면 "none"
   koReading = forms의 kHangul을 출처 순위순(교육용 E > KS X 1001 0 > KS X 1002 1, 같으면 Unihan 순서, "낙:0 락:0E" → 락·낙)
               인명용(N)에만 있는 음은 한국 표준 음이 있으면 뺀다(豫 "서:N 예:0E" → 예). 화면은 첫 음을 대표로 쓴다 // 비면 KANJIDIC2 korean_h
               X 자신의 kHangul·korean_h는 섞지 않는다: 芸(운)→藝 예, 体(분)→體 체처럼 다른 글자의 음이고,
               korean_h에는 한국 표준 밖의 옛 음(校 효)이 섞여 있다 (ACCURACY 4장, build-data.test.ts)
   ```
   기대 결과 (`src/lib/kanji/samples.ts`, 빌드 검증과 vitest가 같이 씀): `学→學 form 학` · `職→職 same 직` · `教→敎 form 교` · `楽→樂 form 악·락` · `直→直 same 직`(글꼴만 다름) · `青→靑` · `真→眞` · `国→國` · `読→讀` · `売→賣` · `気→氣` · `円→圓 원` · `図→圖`
   - 같은 코드포인트지만 글꼴 모양이 다른 글자(直·骨·角·令 등)는 "same"이고, 화면에서 `lang="ja"`/`lang="ko"` 두 글꼴로 나란히 보여준다 (`designer`)
   - 결과 (2026-11-09 데이터): same 1,808 · form 319 · none 9. none = 일본 국자 込·働·枠, 일본 뜻 전용 咲·丼, **Unihan에 연결이 없는** 柿(枾)·既(旣)·闘(鬪)·姫(姬). 손으로 채우지 않는다(정확도 원칙 1) — `docs/ACCURACY.md` 4장
4. **역방향 인덱스**: 모든 X에 대해 `oldForms`와 `ko.forms`(X와 다르면) → X. 상용한자 자신은 키가 되지 않는다. 한 구자체가 두 신자체로 가면 배열로 두고 UI에서 고르게 한다 (현재 데이터엔 없음)
5. **검증 후 쓰기**: 글자 수(2,136), 샘플 13개 일치, 역방향 값이 모두 상용한자. 실패하면 파일을 쓰지 않는다. 묶음별 개수·variant/twin/none 목록·빈 읽기 비율을 출력하니 갱신 PR마다 눈으로 확인한다
6. `src/data/SOURCES.md` 생성 (버전·날짜, EDRDG 문구, Unicode License 전문, 획순 문구)

## 런타임 API
- `src/lib/kanji/data.ts` — **서버 전용**(`import "server-only"`, kanji.json 약 690KB를 클라이언트 번들에 넣지 않는다). Next는 패키지 없이 처리하고 Vitest는 `vitest.config.mts` 별칭으로 빈 모듈. **`tsx` 스크립트(eval·cards)에는 별칭이 없어** `data.ts`를 값으로 import하면 `Cannot find module 'server-only'` — 타입만 import하고 `src/data/kanji.json`을 직접 읽거나, 그 이슈에서 별칭을 마련한다
  - `getKanji(char)`: `kanji.json`(상용한자) → 없으면 `null`. 상용 밖 글자용 `kanji-all.json`(kanjidic 전체 약 10k자, 기본 필드만)은 필요해지면 추가
- `src/lib/kanji/variants.ts` — 클라이언트에서도 쓴다(variants.json 약 7KB)
  - `japaneseFormsOf(char)`: 구자체·한국 자형의 신자체 후보 배열(아니면 `[]`)
  - `normalizeToJapanese(char)`: 신자체가 **하나**면 `{ char: 신자체, from: 원래 글자 }`, 아니면 `{ char }`. 여럿이면 고를 근거가 없어 그대로 둔다(현재 데이터엔 없음 — `variants.test.ts`가 지킨다. 생기면 고르는 화면이 필요)
  - `kanjiHref(hit)`: `/kanji/学?from=學`
- 라우팅: `src/proxy.ts`가 `/kanji/國` → `/kanji/国?from=國`로 redirect(**307**). 페이지 안의 `redirect()`는 스트리밍이 시작된 뒤라 meta 태그로만 이동해서 proxy에서 처리한다. 308은 브라우저가 영구 캐시하는데 매핑은 데이터 갱신으로 바뀔 수 있어 쓰지 않는다. 주소의 첫 글자만 보는 규칙은 `charFromParam`(loader.ts)을 페이지와 같이 쓴다
- 배너: 한자 페이지가 `from`이 그 글자의 실제 이체자일 때만 "한국 國 → 일본 国"을 보여준다. 한국 표준 자형(`ko.forms`)이 아니고 구자체이기만 하면(插·艷·襃·鬭) "구자체 插 → 일본 挿"
- 검색 칩도 같은 규칙: 신자체 칸 아래 작게 `學→学` (`kanji-search`)
- 획순 데이터(`hanzi-writer-data-jp`)에 구자체(樂 15획)가 있어도 **일본 페이지(楽 13획)만** 보여준다 (TASKS L3①)

## 출처 표기 규칙
- 사전 섹션 제목 옆 배지: `사전 · KANJIDIC2` / 단어: `JMdict` / 차이: `Unihan`
- 앱 '정보' 화면: `SOURCES.md` 내용 (EDRDG 문구, Unicode License, hanzi-writer-data-jp 문구)
- README 라이선스 절에도 동일

## 갱신
- jmdict-simplified는 매주 월요일 릴리스. `.github/workflows/data-refresh.yml`(월 1회)이 `npm run data:build` 후 변경이 있으면 PR을 연다. Unihan은 연 1회(9월) — 새 버전은 `UNIHAN_VERSION`을 올리는 PR로
- 데이터 버전(`dataVersion` = `kanjidic2-<사전 날짜>+unihan-<버전>`)은 두 JSON 상단에 기록하고 카드 캐시 무효화에 쓴다 (`card-pipeline`). 알고리즘을 바꿔 결과가 달라지면 카드 캐시 영향도 같이 확인한다

## 완료 기준
- `npm run data:build` 성공, vitest `build-data.test.ts`(알고리즘 규칙) · `data.test.ts`(샘플 13개 + 역방향) 통과
- `/kanji/学` 사전 섹션(`src/components/KanjiDictionary.tsx`, 서버 컴포넌트)에 ガク · まな(ぶ) · 8획 · 초등학교 1학년(grade 8은 "중학교 이후"), 한국 한자 섹션에 学(일본)·學(한국) 나란히 + 한국 음 학, 출처 배지 보임. 같은 글자(直)는 일본 글꼴·한국 글꼴로 나란히, 한국 자형이 없으면 이유(국자면 "일본에서 만든 글자") + 한국 음 뒤에 "(KANJIDIC2)". 상용한자 밖 글자는 "사전 정보는 아직 없어요" 안내
- `/kanji/學`·`/kanji/國` → 신자체로 이동 + 배너
