---
name: kanji-stroke
description: 한자·가나 획순 애니메이션 구현 가이드 (필수 기능). hanzi-writer + 일본어 획순 데이터로 획이 진하게 채워지는 애니메이션, 한 획씩 보기, 따라 쓰기 퀴즈를 만들거나 고칠 때 사용. "획순", "한자 쓰기", "stroke", "kanji", "따라쓰기", "바텀시트 한자" 요청에 사용.
---

# Kanji Stroke (일본식 획순)

## 왜 이 조합인가
- **hanzi-writer** (v3.7): 획을 중심선을 따라 마스크로 **채워 그리는** 애니메이션 + 따라 쓰기 퀴즈 내장 → "글씨가 진하게 채워지는 형태" 요구사항과 일치.
- 기본 데이터는 **중국식** 획순이다. 반드시 일본어 데이터로 바꾼다 (必·飛 등은 획순이 다름).
- 일본어 데이터: npm `@k1low/hanzi-writer-data-jp@0.8.0` — 글자당 JSON 1개(`{strokes, medians}`), 약 6,700자, **히라가나·가타카나 포함**.
  - 확인된 글자: 私 学 必 飛 書 職 就 活 動 齢 鬱 々 𠮟 あ ア ヴ ー / 데이터 없음: 薔 龘 〜

## 0단계: 데이터 URL 확인 (코딩 전 1분)
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://cdn.jsdelivr.net/npm/@k1low/hanzi-writer-data-jp@0.8.0/%E7%A7%81.json"  # 私
curl -s -o /dev/null -w "%{http_code}\n" "https://cdn.jsdelivr.net/npm/@k1low/hanzi-writer-data-jp@0.8.0/%E3%81%82.json"  # あ
```
200이면 진행. 실패하면 unpkg(`https://unpkg.com/@k1low/hanzi-writer-data-jp@0.8.0/<글자>.json`)로 바꿔 다시 확인. 둘 다 실패하면 사용자에게 알린다.

## 구현
`npm i hanzi-writer`

### `src/lib/kanji/loader.ts`
- 소스 목록: jsDelivr → unpkg 순서. URL의 글자는 `encodeURIComponent(char)`.
- `Map<string, Promise<CharData | null>>` 캐시 (같은 글자 재요청 방지). 404/네트워크 오류면 다음 소스, 전부 실패면 `null`.
- 판별 함수: `isKanji = /\p{Script=Han}/u`, `isKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u`

### `src/components/KanjiStroke.tsx` (`'use client'`)
- `useEffect` 안에서 `const HanziWriter = (await import('hanzi-writer')).default` (SSR 회피).
- 먼저 `loadCharData(char)` → `null`이면 "이 글자는 획순 데이터가 없어요" 상태 표시 (에러 아님).
- 생성 옵션:
  ```ts
  HanziWriter.create(el, char, {
    width: size, height: size, padding: 8,
    showOutline: true, showCharacter: false,
    strokeColor: INK, outlineColor: LINE, highlightColor: ACCENT, drawingColor: ACCENT,
    strokeAnimationSpeed: speed, delayBetweenStrokes: 250,
    charDataLoader: (c, onLoad, onError) => {
      loadCharData(c).then((d) => (d ? onLoad(d) : onError(new Error('no-data'))));
    },
  })
  ```
  - `size = Math.min(컨테이너 너비, 300)` · 회전/리사이즈 시 `writer.updateDimensions({ width, height })`
  - 글자만 바뀌면 재생성 대신 `writer.setCharacter(char)` (로더가 캐시를 조회하므로 새 글자도 그대로 동작)
- **정리**: 언마운트/재생성 시 `el.innerHTML = ''` — 안 하면 SVG가 겹쳐 쌓인다 (가장 흔한 버그).
- 컨테이너: `aspect-square`, `touch-action: none` (**따라 쓰기 중 페이지 스크롤 방지, 모바일 필수**), 배경에 `--line` 색 점선 십자 가이드.

### 컨트롤 (각 버튼 44px 이상)
| 버튼 | 동작 |
|---|---|
| ▶ 재생 | `writer.animateCharacter()` |
| 한 획씩 | 처음 누를 때 `hideCharacter()` 후 `animateStroke(i)`를 i=0부터 하나씩 호출 (앞 획은 남은 채 누적됨). 진행 표시 `i / 총획` |
| 따라 쓰기 | `writer.quiz({ showHintAfterMisses: 2, highlightOnComplete: true, onCorrectStroke, onMistake, onComplete })` → `n / 총획` 표시, 완료 시 "완성!" 토스트 |
| 속도 | 0.5× / 1× / 2× — 옵션 변경 API가 없으므로 writer 재생성 |
- 총 획수: `data.strokes.length` → "총 n획"
- 여러 글자 단어(예: 勉強): 위에 글자 탭(勉 | 強), 현재 글자 강조. 좌우 스와이프는 Should.
- `prefers-reduced-motion`이면 자동 재생하지 않는다.

## 완료 기준
- 테스트 글자 **私 必 飛 職 あ ア** 재생·한 획씩·따라 쓰기 모두 동작, **薔**은 "데이터 없음" 안내
- 375px 뷰포트 바텀시트 안에서 잘림 없음, 따라 쓰기 중 화면이 스크롤되지 않음
- 같은 글자 연타·빠른 전환 시 SVG 중복 없음

## 라이선스 표기 (앱 정보 화면이나 한자 화면 하단에 작게)
`획순 데이터: hanzi-writer-data-jp (animCJK · Make Me a Hanzi 기반) — Arphic Public License, LGPL-3.0`
