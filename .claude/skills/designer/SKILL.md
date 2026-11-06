---
name: designer
description: 디자인 담당. 화면·컴포넌트를 만들거나 스타일을 바꿀 때, 공통 헤더(로고 → 홈)·출처 배지·상태(로딩/빈/오류/대체) 표준·모바일 레이아웃·접근성이 필요할 때 사용. "디자인", "UI", "화면", "레이아웃", "헤더", "배지", "오류 화면", "모바일", "스타일" 요청에 사용.
---

# Designer (SENSE 디자인 시스템 v2)

디자인 엔진은 **UI UX Pro Max**(`/ui-ux-pro-max`)다. 토큰의 정답은 그 스킬이 관리하는 `design-system/sense/MASTER.md`(+ `pages/*.md` 화면별 오버라이드)이고, `src/app/globals.css`는 MASTER.md와 동기화한다. `docs/design.md`는 콘셉트(한자 연습장 칸 + 먹 + 蘇芳)·레퍼런스·결정 기록이다. 이 스킬은 **프로젝트 고유 규칙**(헤더·배지·4가지 상태·모바일·접근성)과 **엔진을 쓰는 순서**를 담당한다. 충돌 시 우선순위: 이 스킬의 규칙 > MASTER.md > 외부 참고 스킬.

## 토큰 (`design-system/sense/MASTER.md` ↔ `globals.css`)
0-13 이관 전까지의 값: `--paper #FAF7F0` 배경 · `--surface #FFFFFF` 카드 · `--ink #1F1B16` 본문·획 · `--muted #6B645A` 보조 · `--line #E7E0D4` 선·칸 · `--accent #9E3D3F`(蘇芳) 버튼·현재 획·활성 · `--accent-soft #F6E7E5` · `--ok #3E7B57`
글꼴: UI Noto Sans KR · 일본어 Noto Sans JP(line-height 1.8) · 큰 한자 Klee One. 본문 16px↑, 입력창 17px.
브랜드 결정(grill-me 11-06): 연한 아이보리 배경, 와인색 포인트(순빨강 금지), 먹색 텍스트·획(순검정 금지), 교과서체 큰 한자. 이 네 가지는 MASTER.md를 생성·갱신해도 유지한다. 바꾸려면 `/grill-me`로 결정 → MASTER.md 수정 → globals.css 동기화 → `docs/design.md` 결정 기록 순서.

## UI UX Pro Max를 쓰는 순서 (새 화면·기능마다)
1. `design-system/sense/MASTER.md`를 읽는다. 그 화면의 `pages/<이름>.md`가 있으면 그것이 우선
2. 화면 성격이 다르면(예: 한자 페이지의 큰 글자·연습 칸, 독해 리더) `"<설명>" --design-system -p "SENSE" --page "<이름>" --persist --output-dir .` 로 페이지 오버라이드를 만든 뒤 브랜드 결정 네 가지에 맞게 손으로 다듬는다. `--force`는 쓰지 않는다
3. 구체 패턴은 `--domain` 조회 1~3회: `ux`(로딩·빈 상태·바텀시트·캔버스·키보드 포커스), `typography`/`google-fonts`(CJK 후보), `chart`(학습 기록), `icons`, `landing`(Phase 3). 스택 권고는 `--stack nextjs`
4. 결과를 설계 메모(이슈 코멘트 또는 PR 본문)에 인용하고, 이 스킬의 규칙(헤더·배지·4가지 상태·접근성·모바일)으로 구현한다
5. 다이얼은 `--variance 3 --motion 3 --density 4` (공부 노트처럼 차분하게). 더 올리려면 결정 기록에 이유를 남긴다
- 조회 결과는 "권고"다. 이 스킬의 규칙이나 브랜드 결정과 어긋나면 적용하지 않고 `docs/design.md` "검토한 대안"에 한 줄 기록
- Python 3 필요(`py -3` 포함). 검색이 비어 있으면 더 좁은 질의로 1회 재시도 후, 그래도 없으면 "검증된 권고 없음"이라고 적고 일반 기본값으로

## 공통 헤더 `src/components/AppHeader.tsx` (TASKS L4 — 심사에서 지적된 기본기)
- **모든 화면 상단**에 같은 헤더: 로고(32px, multiply) + `SENSE/センセ` 워드마크 = **하나의 `<Link href="/">`**, 터치 영역 44px↑, `aria-label="SENSE 홈으로"`
- 한자 페이지는 헤더 아래에 뒤로 가기 + 큰 글자 행. 뒤로 가기는 `router.back()`이 아니라 `/` 링크(딥링크로 들어온 사용자가 빈 히스토리로 막히지 않게)
- 현재 페이지가 홈이면 로고 링크는 스크롤 맨 위로. layout.tsx에 넣어 중복을 없앤다

## 출처·상태 배지 `src/components/Badge.tsx`
- 사전 데이터: `사전 · KANJIDIC2` (`--line` 테두리, muted 글자) · 단어 `JMdict` · 자형 `Unihan`
- AI: `검수 완료`(ok 색) / `AI 생성 · 자동 검증`(muted) / `AI 생성 · 검증 중`(accent-soft 배경)
- 배지는 섹션 제목 오른쪽, 12px 이상, 탭하면 짧은 툴팁("EDRDG의 KANJIDIC2 사전 데이터예요") → 앱 '정보' 화면 링크

## 모든 데이터 영역의 4가지 상태 (필수)
| 상태 | 모양 |
|---|---|
| 로딩 | 스켈레톤 + "…하는 중" 텍스트(스크린리더용 `role="status"`) |
| 빈 | 다음 행동이 있는 문장 + 예시 칩 (홈: 履歴書 · 面接 · 職) |
| 오류 | 원인 한 줄(네트워크/AI/데이터 구분) + [다시 시도] 44px. 오류여도 **이미 있는 정보(사전 섹션·획순)는 지우지 않는다** |
| 대체 | AI가 없을 때 사전 섹션만으로도 완결된 화면. "설명을 준비하지 못했어요 — 읽기와 뜻은 사전 데이터예요" |

## 레이아웃
- 375×812 기준, `max-w-md`, 좌우 20px, 가로 스크롤 금지, `100dvh`, safe-area. 하단 탭 2개(한자·학습) 56px + safe area
- 간격 4px 단위 · 카드 radius 16 · 칩 full · 연습 칸 6 · 그림자는 시트에만 1단계
- 일본 글꼴 vs 한국 글꼴 비교 칸: 같은 글자를 `lang="ja"`·`lang="ko"`로 나란히, 아래에 "일본 글꼴 / 한국 글꼴" 라벨 (자형 차이가 코드포인트가 아니라 글꼴에서 오는 경우를 설명)

## 접근성
- 터치 44×44↑, 아이콘 버튼 `aria-label`, `focus-visible` 링 accent, 대비 AA, `prefers-reduced-motion` 시 자동 재생 끔
- E2E `a11y.spec`(axe)로 심각 위반 0을 유지 (`testing`)

## 준비중 패턴
- 학습 탭 카드에 `준비중` 배지 → `ComingSoonSheet`: 제목 "서비스 준비중입니다" + pitch 한 줄 + [확인]. 기능이 완성되면 `src/lib/features.ts`의 `status`만 `live`로

## 참고용 스킬 (사용자가 직접 부를 때만 — 기본으로 켜지 않는다)
| 스킬 | 참고하는 것 | 하지 않는 것 |
|---|---|---|
| `/design-taste-frontend` (Taste Skill, 프로젝트 스킬로 설치해 수동 호출 전용) | 넘기기 전 **"AI 티" 감사**: 똑같은 카드 3연속·Inter 기본·가짜 수치·장식 점·줄표 남발·필러 문구·히어로가 뷰포트 밖. Phase 3 랜딩 페이지의 사전 점검 목록 | 토큰·글꼴 제안, 화면 재설계, 사진·스톡 이미지, 브리프에 없는 사실·수치. 기본 다이얼 8/6/4는 쓰지 않고 3/3/4 명시 |
| `frontend-design` (Anthropic 플러그인) | 토큰 안에서 컴포넌트·타이포 다듬기 아이디어 | 팔레트·레이아웃 결정 |
호출 시 붙이는 문장: `MASTER.md의 토큰·글꼴·radius·간격은 바꾸지 마. 감사 결과만 목록으로. 사진·수치 생성 금지. 다이얼 3/3/4.`
참고 스킬이 켜져 ui-ux-pro-max와 다른 말을 하면 **ui-ux-pro-max와 이 스킬의 규칙이 이긴다**. Taste는 턴을 많이 쓰므로(한 번에 10턴 이상) 이슈당 1회, 넘기기 직전 감사에만

## 하지 말 것
보라/인디고, 의미 없는 그라데이션, 이모지 장식, 12px 이하 본문, 회색 위 옅은 회색, 화면마다 다른 버튼, 오류 시 화면 전체를 오류로 덮기, 브랜드 결정 네 가지를 깨는 팔레트 적용, MASTER.md를 `--force`로 덮어쓰기

## 끝나면
375px·430px 두 폭에서 확인(Playwright MCP 스크린샷을 `docs/screenshots/`에). 새 화면은 `nav.spec`·`a11y.spec`에 추가.
