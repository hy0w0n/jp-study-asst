---
name: kanji-search
description: 한자 입력 3종(타이핑 / 손글씨 / 사진) 구현 가이드. 손글씨·사진은 Claude 비전(AI SDK `@ai-sdk/anthropic`) 하나(/api/vision)로 후보를 얻고, 후보를 사전 데이터로 걸러 실제 한자만 보여주며, 구자체·한국 자형은 일본 신자체로 바로잡아 /kanji/[글자]로 보낸다. "한자 검색", "손글씨", "필기 인식", "사진으로", "카메라", "OCR", "후보" 요청에 사용.
---

# Kanji Search (타이핑 · 손글씨 · 사진 → 한자 페이지)

흐름: **입력 → 인식 → 후보(사전으로 검증) → `/kanji/[글자]`**. 획순은 입력 화면 위에 겹쳐 그리지 않는다.
현재 상태: ① 타이핑은 완료(`src/components/KanjiSearch.tsx`). ③ 손글씨 → ② 사진 순으로 만든다 (해커톤 결정). 못 만든 입력 방식의 버튼은 두지 않는다.

## 공통 규칙 (v2에서 추가)
- **후보 검증**: 인식 결과의 각 글자를 `kanji-data`의 `getKanji()`로 확인한다. 사전에 없는 글자(오인식·한자가 아닌 기호)는 버린다. 상용한자를 앞에 둔다
- **자형 정규화**: `normalizeToJapanese()`로 구자체·한국 자형(學·國·敎)을 신자체로 바꾸고, 칩에 `學→学`처럼 작게 표시한다. 한국어 사용자는 한국식으로 쓰는 일이 많다 — 손글씨에서 특히 중요
- 결과 위 안내: "AI 인식 결과예요. 맞는 글자를 골라 주세요" (사진·손글씨)
- 오류: "잘 안 보여요. 더 가까이, 밝은 곳에서 다시 찍어 주세요" + [다시 시도]. 네트워크·AI 실패와 "일본어 없음"을 구분해 말한다

## ① 타이핑 (완료 — 유지 규칙)
- 한자·가나만 추출(`/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu`), 중복 제거, 한 글자면 바로 이동, 여럿이면 칩
- v2 추가: 추출 후 `normalizeToJapanese()` 적용. 한글·로마자만 입력하면 안내 문구 (AI 조회는 만들지 않는다)

## ③ 손글씨 (`/api/vision` handwriting) — 먼저
- 홈의 **손글씨** 버튼 → 검색창 아래 **인라인** 캔버스(별도 시트 없음). **한 글자**만
- 정사각 `<canvas>` (화면 너비 - 32px, 최대 320px), 흰 배경, 먹색 8px 둥근 선, Pointer Events. 컨테이너 `touch-action: none`(그리는 중 스크롤 방지). 버튼: 되돌리기(획 단위) · 지우기 · 찾기
- 캔버스를 PNG data URL → `POST /api/vision { image, mode: "handwriting" }` → 후보 최대 5개 칩 → 탭하면 이동
- 정확도 팁: 캔버스에 연습 칸처럼 점선 십자를 그려 두면 글자가 중앙에 오고 인식률이 오른다. 배경은 투명이 아닌 흰색으로 보낸다

## ② 사진 (`/api/vision` photo)
- `<input type="file" accept="image/*" capture="environment">` (카메라 바로 열림, 갤러리 선택도 허용) + **예시 사진 버튼**(public/samples/*.jpg, 데모·테스트용)
- 업로드 전 브라우저에서 긴 변 1280px·JPEG 0.8로 축소 (`canvas.toBlob`). Vercel 함수 본문 4.5MB 제한
- 결과: 사진 속 한자를 등장 순서대로 칩(중복 제거, 가나 제외). 문장 전체(`text`)도 받아 두면 독해 기능으로 이어진다

## 서버 `/api/vision` (Route Handler)
- `@ai-sdk/anthropic` + 구조화 출력(`generateObject`), 모델 `ANTHROPIC_VISION_MODEL ?? ANTHROPIC_MODEL ?? "claude-haiku-5-5"`. 학교 API가 멀티모달을 지원하는지 먼저 확인(`.env.example` 주석). 이미지는 AI SDK의 image content part로 전달 (설치본 문서 확인)
- 스키마(zod): `{ candidates: { char: string; confidence?: number }[]; text?: string }`
- 프롬프트
  - handwriting: "손으로 쓴 일본 한자 또는 가나 한 글자다. 가능성 높은 후보를 5개까지 확률 순으로. 한국식 자형(예: 學)으로 썼을 수 있으니 그 경우 그 글자를 그대로 적는다."
  - photo: "사진 속 일본어 텍스트를 text에 옮기고, 등장 순서대로 한자를 중복 없이 candidates에."
  - 공통: "일본어·한자가 없으면 candidates는 빈 배열."
- 서버 검증: `[...char].length === 1` · `isKanji || isKana` · `getKanji()` 또는 `normalizeToJapanese()`로 존재 확인 · 정규화 적용. 통과한 것만 반환
- 비용: 이미지 1장 ≈ 1~1.5k 입력 토큰. 사용자별 분당 요청 제한(간단한 메모리/Upstash 카운터)을 두고 초과 시 "잠시 후 다시" 안내

## 완료 기준
- 손글씨: 職·私·日(+ 한국식 學)을 써서 후보 5개 안에 정답, 學은 `学`으로 정규화 표시 → 탭하면 `/kanji/学`
- 사진: 예시 사진(履歴書 양식)에서 칩 → 한자 페이지. 한자 없는 사진은 "일본어가 없어요"
- 375px에서 캔버스·카메라·후보가 잘리지 않고, 그리는 중 스크롤되지 않음 (Playwright: CDP 터치 드래그로 확인)
- E2E: `/api/vision`을 `page.route`로 목 응답해 후보 → 이동 동선 테스트 (`testing`)
