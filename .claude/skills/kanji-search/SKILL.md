---
name: kanji-search
description: 한자 검색 입력 3종(직접 타이핑 / 사진 촬영 / 손글씨)을 구현할 때 사용. 사진·손글씨는 Claude 비전(학교 API) 하나(/api/vision)로 처리해 한자 후보를 고르게 하고, 고른 한자는 kanji-stroke 획순 화면으로 연결한다. "한자 검색", "사진으로", "카메라", "손글씨", "필기 인식", "OCR" 요청에 사용.
---

# Kanji Search (타이핑 · 사진 · 손글씨)

핵심 설계: **사진과 손글씨는 둘 다 "이미지 → Claude 비전 → 한자 후보"** 로 같은 API를 쓴다.
손글씨를 먼저 만들면 사진은 파일 선택 + 축소만 추가하면 된다. 결과는 항상 **후보 목록에서 사용자가 고르는 방식** (AI 인식은 틀릴 수 있다).

구현 순서 (grill-me 11-06 확정): ① 타이핑(Tier 1) → ③ 손글씨(Tier 2 첫 항목, `/api/vision`을 손글씨 모드로 먼저 만든다) → ② 사진(그다음). 못 한 입력 방식은 **버튼 자체를 두지 않는다** (준비중 배지 금지 — 준비중은 문법·독해·청해 3개 고정).

## 화면
- 홈 `/` 상단에 검색 바 + 입력 방식 버튼: **입력 · 손글씨** (+ 사진은 ②가 되면) (각 44px 이상)
- 결과: 한자 칩 목록 → 칩을 탭하면 `KanjiStroke` 바텀시트
- 결과 위에 작은 안내: "AI 인식 결과예요. 맞는 글자를 골라 주세요" (사진·손글씨일 때만)

## ① 직접 타이핑 (10분)
- 입력값에서 한자·가나만 뽑아 칩으로: `/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu`, 중복 제거, 순서 유지.
- 한자·가나가 하나도 없으면 (한글·로마자만) → 안내 한 줄 "한자나 가나를 입력해 주세요". `/api/kanji-lookup`(AI로 찾기)은 오늘 만들지 않는다 (grill-me 11-06).
- placeholder: `한자나 단어를 붙여넣기 (예: 履歴書)`

## ② 사진 (30분)
- `<input type="file" accept="image/*" capture="environment">` — 모바일에서 바로 카메라가 열린다.
- **업로드 전 브라우저에서 축소 필수**: 긴 변 최대 1280px, JPEG 품질 0.8 (`canvas.toBlob`). 폰 원본 사진은 수 MB이고, Vercel 함수는 요청 본문 4.5MB를 넘으면 413 에러를 낸다.
- `POST /api/vision` `{ image: <base64 data URL>, mode: "photo" }`
- 진행 표시: 미리보기 썸네일 + "읽는 중…" (보통 수 초)

## ③ 손글씨 (15분, ②보다 먼저 — `/api/vision`을 여기서 만든다)
- 홈의 `손글씨` 버튼을 누르면 검색창 아래에 **인라인**으로 펼쳐진다 (별도 시트 없음). **한 글자만** 쓰게 한다.
- 정사각형 `<canvas>` (화면 너비 - 32px, 최대 320px), 흰 배경, 먹색 8px 둥근 선, Pointer Events로 그리기.
- 컨테이너 `touch-action: none` (그리는 중 스크롤 방지). 버튼: 되돌리기(획 단위) · 지우기 · 찾기.
- 캔버스를 PNG data URL로 → 같은 `/api/vision`, `mode: "handwriting"`.

## 서버: `/api/vision` (Route Handler)
- `ANTHROPIC_API_KEY`·`ANTHROPIC_BASE_URL`은 서버에서만 (`@ai-sdk/anthropic`, 연결 방식은 `/api/kanji`와 같게). 모델은 `process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5'` (Haiku 5.5가 이미지 입력을 지원하므로 새 변수를 만들지 않는다). 생각(thinking)이 출력 상한을 먹지 않게 끄거나 상한을 넉넉히.
- Vercel AI SDK의 구조화 출력(스키마 기반 객체 생성)을 쓴다. 버전별 API가 다르니 설치된 버전 문서(또는 context7)를 확인한다.
- 응답 스키마 (zod로 검증):
  ```ts
  { candidates: { char: string; reading?: string; meaning_ko?: string }[]; text?: string }
  ```
- 프롬프트
  - `photo`: "사진 속 일본어 텍스트를 그대로 옮겨 text에 넣고, 등장 순서대로 한자를 중복 없이 candidates에 넣어라. reading은 그 문맥의 읽기(히라가나), meaning_ko는 한국어 뜻 한 단어."
  - `handwriting`: "손으로 쓴 한 글자다. 가장 가능성 높은 일본 한자(또는 가나) 후보를 5개까지 확률 순으로 candidates에 넣어라."
  - 공통: "일본어가 없으면 candidates를 빈 배열로." 
- 후보 정리: 서버나 클라이언트에서 `char`가 한 글자인지 확인하고, 획순 데이터(`loadCharData`)가 없는 후보는 "획순 없음" 표시.
- 실패 처리: 타임아웃·파싱 실패 시 "잘 안 보여요. 더 가까이, 밝은 곳에서 다시 찍어 주세요" + [다시 시도].

## 완료 기준
- 타이핑: `就職活動` 붙여넣기 → 4개 칩, `직업` → AI 후보에 職 포함
- 사진: 인쇄된 일본어(예: 책 표지, 화면 사진)에서 한자 칩이 나오고 탭하면 획순 시트
- 손글씨: 私 · 学 · 日을 손가락으로 써서 후보 5개 안에 정답 포함
- 375px에서 카메라·캔버스·결과가 잘림 없이 동작, 그리는 중 화면이 스크롤되지 않음
