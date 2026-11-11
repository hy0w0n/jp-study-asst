---
name: card-pipeline
description: 한자 설명 카드의 생성→검증→저장→서빙 파이프라인. 검증을 통과한 카드를 저장해 모든 사용자에게 같은 결과를 보여주고, 상용한자는 미리 생성해 런타임 AI 의존을 없앤다. "카드 캐시", "DB 적재", "미리 생성", "배치 생성", "토큰 절감", "같은 결과", "검수", "Supabase 카드" 요청에 사용.
---

# Card Pipeline (검증된 카드 저장·서빙)

목표 (사용자 결정 2026-11-06): **정확성이 확인된 카드만 저장하고, 같은 한자는 모든 사용자에게 같은 카드를 보여준다.** 사용자가 늘어도 AI 토큰이 늘지 않고, 상용한자는 결국 AI 호출 없이 동작한다.

## 카드의 두 층
| 층 | 내용 | 출처 | 생성 시점 |
|---|---|---|---|
| **사전** (facts) | 음독·훈독·한국 음·자형 차이·획수·급수 | `kanji-data` 정적 JSON | 빌드 시, AI 없음 |
| **설명** (ai) | 한국어 뜻, 단어 2개(JMdict 후보에서 고름 + 한국어 뜻), 예문 1개(후리가나+번역). 외우기 팁은 검증 수단이 없어 v2에서 뺐다 | AI 생성 → 검증 | 아래 파이프라인 |

## 저장소 선택
- **상용한자 2,136자 = 정적 JSON** (`src/data/cards/<코드포인트>.json` 또는 한 파일 `cards.json`). 배치로 미리 생성·검증·검수해 **git에 커밋**한다. 장점: CDN 캐시, 무료, 버전 관리(PR에서 diff로 검수), 런타임 외부 의존 0. 글자당 약 1KB → 2MB 남짓이므로 글자별 파일 + `import()`로 필요한 것만 불러온다
- **그 외(비상용·인명용) = Supabase `kanji_cards` 테이블** (런타임 캐시). 첫 요청에만 AI가 만들고, 검증을 통과하면 저장해 재사용
- 사용자별 데이터(내 한자장)는 별도 테이블. 카드는 **공용·읽기 전용**

## 카드 상태
`generated`(검증 전) → `auto_verified`(자동 검증 통과) → `verified`(사람 검수) / `rejected`(폐기, 사유 기록)
- 화면 표시: `auto_verified`·`verified`만 보여준다. `generated`는 보여주지 않는다 (틀린 카드가 모두에게 보이는 것이 최악)
- 배지: `verified` → "검수 완료" · `auto_verified` → "AI 생성 · 자동 검증" (`CARD_BADGES`, `src/components/Badge.tsx`)
- 실시간 카드도 판정(규칙 5)까지 통과해야 나오므로(사용자 결정 2026-11-11) 화면의 AI 카드는 모두 `auto_verified`다. "AI 생성 · 검증 중"(판정 전 노출)은 쓰지 않는다

## 자동 검증 (서버, 저장·노출 전 필수) — `src/lib/cards/verify.ts` (#13 구현)
1. **스키마**: zod 모양 + 길이·개수(뜻 1~20자, 단어 정확히 min(2, 후보 수)개, 예문 1~40자(후리가나 뺀 글자), 번역 1~80자, 모든 칸 한 줄)
2. **단어**: 표기가 **단어 후보 목록(words.json, JMdict)에 그대로** 있고 `reading`이 후보와 같다, 중복 없음
3. **후리가나**: 예문의 모든 한자에 `{漢字|よみ}`, 읽기는 가나만, 중괄호 짝. 읽기 대조 — 후보 단어(두 글자 이상)를 통째로 묶었으면 후보 읽기와 같고, 한 글자 묶음은 그 한자의 사전 읽기(`readingForms`: 음독·훈독·어간 + 연탁·촉음)에 있다(`VerifyContext.lookup` = `getKanji`). 후보에 없는 여러 글자 묶음은 대조하지 못한다
4. **예문**: 예문에 이 한자가 있다
5. **판정**: 판정 모델(`ANTHROPIC_CARD_JUDGE_MODEL`, 기본 Haiku 5.5·thinking off)이 한자 뜻·단어 뜻·예문 번역을 1~5점 → 모두 3점 이상. 결정적 규칙을 통과한 카드만 판정에 보낸다
6. **금칙**: 한국어 칸(뜻·단어 뜻·번역)에 가나, 읽기·자형 판단 말(음독·훈독·자형·신자체·구자체·번체·간체·한국 한자·일본 한자)이 없다. 일본어 예문에 한글이 없다
- 순서 (`src/lib/cards/generate.ts`의 `runCardPipeline`): 생성 → 규칙 1~4·6 → 규칙 5 → 떨어지면 **사유를 프롬프트에 붙여 1회 재생성** → 또 떨어지면 `rejected`(미노출, `/api/kanji` 422 + 서버 로그에 사유). 생성·판정 응답이 스키마에 안 맞으면(`NoObjectGeneratedError`) 그 시도의 실패로 센다. 네트워크·API 오류만 502
- 라우트 동작(오류 kind·검증 탈락 미저장·캐시 hit·속도 제한)은 `src/app/api/kanji/route.test.ts`
- 검증 기록은 카드와 함께 둔다: `verification: { promptVersion, dataVersion, model, judgeModel, judge: { meaning, words, translation }, attempts, generatedAt }` (`KanjiCardResponse`, `src/lib/cards/schema.ts`)

## 서빙 순서 `/api/kanji`
목표 (#14·#15 후):
```
1. 정적 카드 있음(상용) → 즉시 반환 (AI 호출 0)
2. Supabase kanji_cards에 auto_verified/verified 있음 → 반환
3. 없음 → AI 생성 → verify → 통과 시 Supabase에 저장(upsert) → 카드 JSON
4. 생성/검증 실패 → 오류 JSON(kind) → 화면은 원인 문구 + [다시 시도]. 사전 섹션은 항상 보인다
```
지금 (#13): 상용한자만(아니면 404 `no-data`) → Vercel Runtime Cache(7일, 키에 `CACHE_VERSION`·프롬프트 판·데이터 판(kanji+words)·모델·판정 모델) → 없으면 IP 제한(10분 30번) → `createKanjiCard` → 통과 카드만 JSON 응답 + 캐시 저장
- 사전 사실은 페이지가 서버에서 바로 그린다(`KanjiDictionary`). AI 칸은 검증 전에 보여줄 수 없어 **스트리밍하지 않고** JSON 한 번으로 받는다 (스켈레톤 "설명을 쓰고 사전과 맞는지 확인하는 중…")
- 오류 JSON `{ error, kind }`: `input` 400 · `no-data` 404 · `rate-limit` 429 · `config` 500 · `ai` 502(모델·네트워크 오류, 30초 초과) · `verify` 422. 화면 문구는 `KanjiExplain`의 `FAIL_TEXT` (네트워크·AI·제한·검증 탈락을 구분)
- 동시 요청으로 같은 글자가 두 번 생성되는 것은 허용(마지막 저장이 이김). 비용이 걱정되면 Supabase에 `generating_at` 잠금 열
- 캐시 키에 `promptVersion`·`dataVersion` 포함. 버전이 오르면 기존 카드는 `stale`로 표시만 하고 계속 보여주다가 배치로 교체

## 배치 생성 `scripts/generate-cards.ts` (`npm run cards:generate -- --grade 1..8 --concurrency 4`)
- 상용한자 전부: 글자당 입력 ~1.5k·출력 ~0.5k 토큰 → Haiku 기준 총 수 달러 수준. 한 번만 내면 끝
- 흐름: 글자 목록 → 이미 `verified`면 건너뜀 → 생성 → verify → `auto_verified`로 JSON 저장 → 실패 목록 `docs/cards-failed.md`
- 재현성: `temperature 0`에 가깝게, 프롬프트 버전 고정. 같은 입력이면 같은 결과를 기대하되, 보장은 저장으로 한다
- 끝나면 `ai-eval`로 표본 50자를 채점해 리포트를 남기고 PR로 올린다 → diff에서 사람이 훑어보며 `verified`로 올릴 수 있다

## 사람 검수 (관리자)
- 간단한 관리자 페이지 `/admin/cards` (환경 변수 `ADMIN_TOKEN` 쿼리 또는 Supabase 관리자 로그인): 카드 열람 → [검수 완료] / [반려 + 사유] / [재생성]
- 반려 사유는 `docs/ACCURACY.md`의 "자주 틀리는 유형"에 누적해 프롬프트·검증 규칙에 반영 (`ai-eval`)

## Supabase 스키마 (`supabase/migrations/0002_cards.sql`)
```sql
create table public.kanji_cards (
  char text primary key,
  status text not null check (status in ('generated','auto_verified','verified','rejected')),
  prompt_version text not null,
  data_version text not null,
  model text not null,
  card jsonb not null,            -- ai 부분
  verification jsonb not null,
  reject_reason text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
alter table public.kanji_cards enable row level security;
create policy "cards: public read of verified" on public.kanji_cards
  for select to anon, authenticated using (status in ('auto_verified','verified'));
-- 쓰기는 서버(service role)만. 클라이언트에 service role 키를 절대 넣지 않는다.
```
- 서버에서만 `SUPABASE_SECRET_KEY`(service role)로 쓰기. `.env.example`에 이름만 추가

## 완료 기준
- `学`을 두 브라우저에서 열면 같은 카드, 두 번째부터 AI 요청 0회(네트워크 탭·서버 로그로 확인)
- 상용한자 배치 완료율·자동 검증 통과율을 `docs/ACCURACY.md`에 기록
- 검증 실패 카드가 화면에 보이지 않음(`generated`는 미노출)
