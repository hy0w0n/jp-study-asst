// npm run data:build — KANJIDIC2(jmdict-simplified) + Unihan 18.0 → src/data/kanji.json·variants.json·SOURCES.md
// 원본은 data-src/(gitignore)에 받아 두고 없을 때만 내려받는다. 검증에 실패하면 아무 파일도 쓰지 않는다.
// 규칙·알고리즘: .claude/skills/kanji-data
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import {
  buildEntry,
  buildTwinIndex,
  buildVariantIndex,
  isJoyo,
  parseUnihan,
  type Kanjidic2,
} from "../src/lib/kanji/build-data";
import type { KanjiEntry, KanjiFile } from "../src/lib/kanji/data";
import type { VariantsFile } from "../src/lib/kanji/variants";
import { KO_FORM_SAMPLES } from "../src/lib/kanji/samples";

const ROOT = join(import.meta.dirname, "..");
const SRC_DIR = join(ROOT, "data-src");
const OUT_DIR = join(ROOT, "src", "data");

const UNIHAN_VERSION = "18.0.0";
const UNIHAN_URL = `https://www.unicode.org/Public/${UNIHAN_VERSION}/ucd/Unihan.zip`;
const UNICODE_LICENSE_URL = "https://www.unicode.org/license.txt";
const UNIHAN_FILES = ["Unihan_Variants.txt", "Unihan_IRGSources.txt", "Unihan_Readings.txt", "Unihan_OtherMappings.txt"];
const KANJIDIC2_RELEASES = "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest";
const KANJIDIC2_ASSET = /^kanjidic2-en-(.+)\.json\.zip$/;
const JOYO_COUNT = 2136;

// .part에 받은 뒤 이름을 바꾼다 — 도중에 끊겨도 깨진 파일이 다음 빌드에서 원본으로 쓰이지 않게
async function download(url: string, path: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`내려받기 실패 ${res.status}: ${url}`);
  writeFileSync(`${path}.part`, Buffer.from(await res.arrayBuffer()));
  renameSync(`${path}.part`, path);
  console.log(`내려받음: ${url}`);
}

async function ensureFile(url: string, name: string): Promise<string> {
  const path = join(SRC_DIR, name);
  if (!existsSync(path)) await download(url, path);
  return path;
}

// 최신 릴리스의 kanjidic2 zip. GitHub API에 닿지 못하면 data-src/에 있는 가장 최근 파일을 쓴다
// CI에서는 GITHUB_TOKEN으로 비인증 요청 한도(IP당 시간 60회)를 피하고, 실패하면 낡은 데이터로 PR을 열지 않게 멈춘다
async function ensureKanjidic2(): Promise<{ path: string; release: string }> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(KANJIDIC2_RELEASES, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const release = (await res.json()) as { assets: { name: string; browser_download_url: string }[] };
    const asset = release.assets.find((a) => KANJIDIC2_ASSET.test(a.name));
    if (!asset) throw new Error("릴리스에 kanjidic2-en zip이 없음");
    return { path: await ensureFile(asset.browser_download_url, asset.name), release: asset.name.match(KANJIDIC2_ASSET)![1] };
  } catch (e) {
    const local = readdirSync(SRC_DIR).filter((f) => KANJIDIC2_ASSET.test(f)).sort().at(-1);
    if (!local || process.env.CI) throw e;
    console.warn(`최신 릴리스 확인 실패(${(e as Error).message}) — 내려받아 둔 ${local} 사용`);
    return { path: join(SRC_DIR, local), release: local.match(KANJIDIC2_ASSET)![1] };
  }
}

function readZip(path: string, names?: string[]): Record<string, string> {
  const files = unzipSync(readFileSync(path), { filter: (f) => !names || names.includes(f.name) });
  const decoder = new TextDecoder();
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, decoder.decode(bytes)]));
}

// 검증: 실패 목록을 돌려준다 (빈 배열이면 통과)
function verify(kanji: Record<string, KanjiEntry>, toJapanese: Record<string, string[]>): string[] {
  const errors: string[] = [];
  const count = Object.keys(kanji).length;
  if (count !== JOYO_COUNT) errors.push(`상용한자 수 ${count} ≠ ${JOYO_COUNT}`);
  for (const [char, expected] of Object.entries(KO_FORM_SAMPLES)) {
    const e = kanji[char];
    const got = e ? `${e.ko.forms.join("")}/${e.ko.diff}` : "없음";
    if (got !== `${expected.forms.join("")}/${expected.diff}`) errors.push(`샘플 ${char}: ${got}`);
    for (const r of expected.koReading) if (!e?.koReading.includes(r)) errors.push(`샘플 ${char}: 한국 음 ${r} 없음`);
  }
  for (const [v, xs] of Object.entries(toJapanese)) {
    if (xs.some((x) => !kanji[x])) errors.push(`역방향 ${v} → ${xs.join("")}: 상용한자가 아님`);
  }
  return errors;
}

function report(kanji: Record<string, KanjiEntry>, toJapanese: Record<string, string[]>) {
  const entries = Object.entries(kanji);
  const by = (pred: (e: KanjiEntry) => boolean) => entries.filter(([, e]) => pred(e));
  const list = (xs: [string, KanjiEntry][]) => xs.map(([c, e]) => (e.ko.forms.length ? `${c}→${e.ko.forms.join("·")}` : c)).join(" ");
  const pct = (n: number) => `${((n / entries.length) * 100).toFixed(1)}%`;
  for (const diff of ["same", "form", "none"] as const) {
    console.log(`한국 자형 ${diff}: ${by((e) => e.ko.diff === diff).length}`);
  }
  // 감사용: Unihan의 직접 연결이 아닌 근거로 고른 자형과 찾지 못한 글자는 목록을 남긴다
  console.log(`  이체자 연결(variant): ${list(by((e) => e.ko.basis === "variant"))}`);
  console.log(`  부수·획수·음 일치(twin): ${list(by((e) => e.ko.basis === "twin"))}`);
  console.log(`  없음(none): ${list(by((e) => e.ko.diff === "none"))}`);
  console.log(`  한국 자형 여러 개: ${list(by((e) => e.ko.forms.length > 1))}`);
  console.log(`음독 없음 ${pct(by((e) => e.on.length === 0).length)} · 훈독 없음 ${pct(by((e) => e.kun.length === 0).length)}`);
  console.log(`  한국 음 없음: ${list(by((e) => e.koReading.length === 0))}`);
  const conflicts = Object.entries(toJapanese).filter(([, xs]) => xs.length > 1);
  console.log(`역방향 ${Object.keys(toJapanese).length}개 · 신자체 여럿: ${conflicts.map(([v, xs]) => `${v}→${xs.join("·")}`).join(" ")}`);
}

// 한 줄에 글자 하나 — 데이터 갱신 PR의 diff를 읽기 쉽게
function toJson(header: Record<string, unknown>, key: string, body: Record<string, unknown>): string {
  const head = Object.entries(header).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = Object.entries(body).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return ["{", ...head, `  ${JSON.stringify(key)}: {`, rows.join(",\n"), "  }", "}", ""].join("\n");
}

function sourcesMd(kanjidic2Release: string, dictDate: string, unicodeLicense: string): string {
  return `# 데이터 출처·라이선스

> \`npm run data:build\`가 만든다. 직접 고치지 말고 \`scripts/build-kanji-data.ts\`를 고친다.
> 앱의 '정보' 화면·출처 배지·README는 이 문구를 그대로 쓴다.

## KANJIDIC2 — 음독·훈독·획수·급수·영어 뜻 (\`src/data/kanji.json\`)
This application uses the KANJIDIC2 dictionary file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group's licence. See https://www.edrdg.org/

- 라이선스: Creative Commons Attribution-ShareAlike 4.0 (https://www.edrdg.org/edrdg/licence.html)
- 판: KANJIDIC2 ${dictDate} (JSON 변환: jmdict-simplified ${kanjidic2Release}, https://github.com/scriptin/jmdict-simplified)
- 이 데이터에서 만든 \`kanji.json\`도 같은 CC BY-SA 4.0 조건을 따른다

## Unihan ${UNIHAN_VERSION} — 구자체·한국 자형·한국 음 (\`src/data/kanji.json\`의 ko·koReading·oldForms, \`src/data/variants.json\`)
- 사용한 속성: kJapaneseOldVariant · kZVariant · kCompatibilityVariant · kTraditionalVariant · kSimplifiedVariant · kSemanticVariant · kIRG_KSource · kHangul · kKoreanEducationHanja · kRSUnicode · kTotalStrokes
- 원본: ${UNIHAN_URL}

\`\`\`text
${unicodeLicense.trim()}
\`\`\`

## 획순 — hanzi-writer-data-jp 0.8.0
획순 데이터: hanzi-writer-data-jp (animCJK · Make Me a Hanzi 기반) — Arphic Public License, LGPL-3.0
`;
}

async function main() {
  mkdirSync(SRC_DIR, { recursive: true });
  const kd = await ensureKanjidic2();
  const unihanZip = await ensureFile(UNIHAN_URL, `Unihan-${UNIHAN_VERSION}.zip`);
  const licensePath = await ensureFile(UNICODE_LICENSE_URL, "unicode-license.txt");

  const kanjidic2 = JSON.parse(Object.values(readZip(kd.path))[0]) as Kanjidic2;
  const unihan = parseUnihan(Object.values(readZip(unihanZip, UNIHAN_FILES)));
  const twins = buildTwinIndex(unihan);

  const kanji: Record<string, KanjiEntry> = {};
  for (const c of kanjidic2.characters.filter(isJoyo)) kanji[c.literal] = buildEntry(c, unihan, twins);
  const toJapanese = buildVariantIndex(kanji);

  report(kanji, toJapanese);
  const errors = verify(kanji, toJapanese);
  if (errors.length > 0) {
    console.error(`검증 실패 — 파일을 쓰지 않았습니다:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }

  // 원본이 같으면 결과도 같도록 빌드 시각은 넣지 않는다 (월간 갱신 PR이 빈 변경으로 열리지 않게)
  const dataVersion = `kanjidic2-${kanjidic2.dictDate}+unihan-${UNIHAN_VERSION}`;
  const sources: KanjiFile["sources"] = { kanjidic2: `${kanjidic2.dictDate} (jmdict-simplified ${kd.release})`, unihan: UNIHAN_VERSION };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "kanji.json"), toJson({ dataVersion, sources }, "kanji", kanji));
  writeFileSync(join(OUT_DIR, "variants.json"), toJson({ dataVersion } satisfies Omit<VariantsFile, "toJapanese">, "toJapanese", toJapanese));
  writeFileSync(join(OUT_DIR, "SOURCES.md"), sourcesMd(kd.release, kanjidic2.dictDate, readFileSync(licensePath, "utf8")));
  console.log(`완료: ${dataVersion} · kanji.json ${Object.keys(kanji).length}자 · variants.json ${Object.keys(toJapanese).length}개`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
