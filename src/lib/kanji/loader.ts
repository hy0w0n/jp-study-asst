// 일본식 획순 데이터 로더 (@k1low/hanzi-writer-data-jp). 글자당 JSON 1개, 히라가나·가타카나 포함.
import type { CharacterJson } from "hanzi-writer";

export type CharData = CharacterJson;

const SOURCES = [
  "https://cdn.jsdelivr.net/npm/@k1low/hanzi-writer-data-jp@0.8.0/",
  "https://unpkg.com/@k1low/hanzi-writer-data-jp@0.8.0/",
];

const cache = new Map<string, Promise<CharData | null>>();

// 두 CDN은 같은 패키지 버전을 비추므로 404는 어느 쪽이든 "데이터 없음"으로 확정한다.
// 그 밖의 실패(네트워크 오류·5xx·깨진 JSON)만 겪었다면 데이터 유무를 모르는 것이라 실패로 끝낸다.
async function fetchFromSources(char: string): Promise<CharData | null> {
  const file = `${encodeURIComponent(char)}.json`;
  let notFound = false;
  for (const base of SOURCES) {
    try {
      const res = await fetch(base + file);
      if (res.ok) {
        const data = (await res.json()) as CharData;
        return isKana(char) ? mergeSplitStrokes(data) : data;
      }
      if (res.status === 404) notFound = true;
    } catch {
      // 네트워크 오류·깨진 JSON이면 다음 소스로
    }
  }
  if (notFound) return null;
  throw new Error(`획순 데이터를 받지 못했어요: ${char}`);
}

// 데이터 0.8.0의 히라가나는 고리·교차가 있는 획을 조각 여러 개로 나눠 두고 중심선(median)을 그대로 복사해 둔다
// (あ 4획, ぬ 4획, の 2획 …). 중심선 점을 4개 이상 공유하는 조각을 한 획으로 합친다.
// 상자(0~1024, -124~900) 밖으로 튄 중심선 점은 따라 쓰기 채점을 망치므로 버린다.
const SAME_STROKE_POINTS = 4;

function inBox([x, y]: number[]) {
  return x >= -10 && x <= 1034 && y >= -130 && y <= 1030;
}

export function mergeSplitStrokes(data: CharData): CharData {
  const { strokes, medians } = data;
  const group = medians.map((_, i) => i);
  for (let i = 0; i < medians.length; i++) {
    for (let j = i + 1; j < medians.length; j++) {
      if (group[j] !== j) continue;
      const shared = medians[i].filter((p, k) => {
        const q = medians[j][k];
        return q && p[0] === q[0] && p[1] === q[1];
      }).length;
      if (shared >= SAME_STROKE_POINTS) group[j] = group[i];
    }
  }
  const out: CharData = { strokes: [], medians: [] };
  group.forEach((g, i) => {
    if (g !== i) return;
    const members = group.flatMap((h, k) => (h === g ? [k] : []));
    const median = members
      .map((k) => medians[k].filter(inBox))
      .reduce((best, m) => (m.length > best.length ? m : best));
    out.strokes.push(members.map((k) => strokes[k]).join(" "));
    out.medians.push(median.length >= 2 ? median : medians[i]);
  });
  return out;
}

/**
 * 데이터가 없는 글자(薔 등)는 null, 네트워크 실패는 reject. 같은 글자는 한 번만 요청하되,
 * 실패는 캐시하지 않아 다시 부르면 새로 요청한다.
 */
export function loadCharData(char: string): Promise<CharData | null> {
  let p = cache.get(char);
  if (!p) {
    const pending = fetchFromSources(char);
    pending.catch(() => {
      if (cache.get(char) === pending) cache.delete(char);
    });
    cache.set(char, pending);
    p = pending;
  }
  return p;
}

export const isKanji = (s: string) => /\p{Script=Han}/u.test(s);
export const isKana = (s: string) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);

/** 라우트 파라미터가 인코딩된 채로 와도(%E8%81%B7) 글자로 되돌린다. */
export function safeDecode(s: string): string {
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** /kanji/[char]의 파라미터에서 첫 글자만 본다 (페이지와 proxy가 같은 규칙을 쓴다). */
export const charFromParam = (raw: string): string => [...safeDecode(raw)][0] ?? "";
