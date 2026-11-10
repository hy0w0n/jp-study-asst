---
name: kanji-stroke
description: 한자·가나 획순 애니메이션(hanzi-writer + 일본식 획순 데이터) 구현·보정 가이드 — 재생·한 획씩·따라 쓰기·속도, 한자 페이지 구성, 가나 조각 획 보정, 획순 데이터 전수 점검(KANJIDIC2 획수 대조), 신자체만 보여주기, 일본/한국 글꼴 비교 표시. "획순", "stroke", "따라쓰기", "획수 틀림", "데이터 점검", "한자 페이지" 요청에 사용.
---

# Kanji Stroke (일본식 획순)

## 핵심 (해커톤에서 확정·검증됨)
- **hanzi-writer 3.7** + `@k1low/hanzi-writer-data-jp@0.8.0`(jsDelivr → unpkg 순, 글자당 JSON, 약 6,700자, 가나 포함). 기본 데이터는 중국식이므로 반드시 일본 데이터
- `src/lib/kanji/loader.ts`: 캐시 · 소스 폴백 · `mergeSplitStrokes`(히라가나 고리·교차 획이 조각으로 나뉜 것을 중심선 공유로 합침: あ 4→3획) · `safeDecode`
- `src/components/KanjiStroke.tsx`(`'use client'`): `import('hanzi-writer')` 동적 로드, `charDataLoader`로 로더 연결, 언마운트 시 `el.innerHTML = ''`(SVG 중복 방지), 컨테이너 `touch-action: none`, 열리면 자동 재생 1회(reduced-motion 제외), 재생 · 한 획씩(`hideCharacter` 후 `animateStroke(i)` 누적) · 따라 쓰기(`quiz` 기본 옵션, 커스텀 금지) · 1×/2×(재생성)
- 데이터 없는 글자(薔 등, 어느 CDN이든 **404**): "이 글자는 획순 데이터가 없어요" — 오류 아님, 사전·AI 섹션은 그대로
- 네트워크 실패(CDN 두 곳 모두 네트워크 오류·5xx·깨진 JSON): `loadCharData`가 reject → "연결이 불안정해서 획순을 불러오지 못했어요." + [다시 시도]. 실패는 캐시하지 않아 다시 시도 시 새로 요청 (#4)

## 한자 페이지 `src/app/kanji/[char]/page.tsx` (v2 구성)
1. 공통 헤더(`designer`: 로고 → 홈 링크) + 뒤로 가기 + 큰 글자(Klee One) + 총 획수(**KANJIDIC2 획수**를 기준으로 표시, 데이터 획수와 다르면 콘솔 경고 + 점검 목록에 추가)
2. 획순 영역 + 컨트롤
3. **사전 섹션**(`kanji-data`): 음독·훈독·한국 한자(자형·음)·급수 + 출처 배지. 글꼴 비교: `<span lang="ja">直</span>` / `<span lang="ko">直</span>` 나란히 — 코드포인트가 같아도 글꼴 모양이 다른 글자(直·骨·角·令·者·海 등)를 눈으로 확인시킨다
4. **설명 섹션**(`card-pipeline`): 저장된 카드 또는 AI 생성 + 상태 배지
5. ☆ 외울 한자로 등록(Tier 2 S3) · 출처 문구
- 구자체·한국 자형 주소(`/kanji/學`)는 신자체로 308 리다이렉트 + 상단 배너 "한국·구자체 學 → 일본 学" (`kanji-data`)
- 획순 데이터에 구자체(樂 15획)가 있어도 보여주지 않는다 — 일본 한자만 (TASKS L3①)

## 획순 데이터 전수 점검 (TASKS L1) — `scripts/audit-strokes.ts` (`npm run data:audit-strokes`)
1. 대상: 상용한자 2,136자 + 가나 전부 (`kanji.json`의 글자 목록 + 가나 표)
2. 각 글자 JSON을 받아(로컬 캐시 `data-src/strokes/`) `mergeSplitStrokes` 적용 후 획수 = `strokes.length`
3. KANJIDIC2 `strokes[0]`와 비교 → 불일치 목록 `docs/stroke-audit.md` (글자, 데이터 획수, 사전 획수, 차이)
4. 불일치 유형별 처리: (a) 조각 분할 → 합치기 규칙 보완 (b) 데이터 자체 오류 → 예외 표 `src/data/stroke-overrides.json`(획수만 사전 값으로 표시, 애니메이션은 그대로) (c) 사전 쪽 복수 획수(薔 16/17) → 둘 다 허용
5. 결과를 이 스킬 하단 "점검 기록"에 날짜와 함께 적는다. 자동화: `ralph-wiggum` 루프로 "불일치 0 또는 전부 분류"를 완료 조건으로 돌려도 된다
- 획순 **순서** 자체의 정오는 자동 검증이 어렵다. 의심 글자는 `ux-tester`/사용자가 일본 교과서 획순(例: 必·飛·右·左)과 눈으로 대조하고 `docs/ACCURACY.md`에 기록

## 연습 모드 (내 한자장, Tier 2 S3)
- 같은 `KanjiStroke`의 따라 쓰기를 재사용. 등록한 한자를 `mistakeCount` 많은 순으로 출제. `onMistake`로 실수 수, `onComplete`에서 `practiceCount+1`·`lastPracticedAt` 갱신(localStorage → 나중에 Supabase)

## 완료 기준
- 私 必 飛 職 あ ア 재생·한 획씩·따라 쓰기, 薔 데이터 없음 안내, 375px, 따라 쓰기 중 스크롤 없음, 인코딩 주소 동작
- 획수 표시가 KANJIDIC2와 일치(상용 2,136자 점검 완료 또는 예외 표 등록)
- `/kanji/學`·`/kanji/樂` → 신자체 페이지

## 라이선스 표기
`획순 데이터: hanzi-writer-data-jp (animCJK · Make Me a Hanzi 기반) — Arphic Public License, LGPL-3.0` · 획수·읽기: KANJIDIC2 (EDRDG, CC BY-SA 4.0)

## 점검 기록
- 2026-11-06: 가나 13자 + 한자 2자 획수 일치 확인(mergeSplitStrokes). 전수 점검 미실시
