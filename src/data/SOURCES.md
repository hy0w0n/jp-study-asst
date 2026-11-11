# 데이터 출처·라이선스

> `npm run data:build`가 만든다. 직접 고치지 말고 `scripts/build-kanji-data.ts`를 고친다.
> 앱의 '정보' 화면·출처 배지·README는 이 문구를 그대로 쓴다.

## KANJIDIC2 — 음독·훈독·획수·급수·영어 뜻 (`src/data/kanji.json`)
This application uses the KANJIDIC2 dictionary file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group's licence. See https://www.edrdg.org/

- 라이선스: Creative Commons Attribution-ShareAlike 4.0 (https://www.edrdg.org/edrdg/licence.html)
- 판: KANJIDIC2 2026-11-09 (JSON 변환: jmdict-simplified 3.6.2+20261109214828, https://github.com/scriptin/jmdict-simplified)
- 이 데이터에서 만든 `kanji.json`도 같은 CC BY-SA 4.0 조건을 따른다

## JMdict — 단어 후보의 표기·읽기·영어 뜻 (`src/data/words.json`)
This application uses the JMdict dictionary file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group's licence. See https://www.edrdg.org/

- 라이선스: Creative Commons Attribution-ShareAlike 4.0 (https://www.edrdg.org/edrdg/licence.html)
- 판: JMdict 2026-11-10 (영어판 JMdict_e, https://www.edrdg.org/pub/Nihongo/JMdict_e.gz) — 빈도 태그가 있는 common 항목만
- 이 데이터에서 만든 `words.json`도 같은 CC BY-SA 4.0 조건을 따른다

## Unihan 18.0.0 — 구자체·한국 자형·한국 음 (`src/data/kanji.json`의 ko·koReading·oldForms, `src/data/variants.json`)
- 사용한 속성: kJapaneseOldVariant · kZVariant · kCompatibilityVariant · kTraditionalVariant · kSimplifiedVariant · kSemanticVariant · kIRG_KSource · kHangul · kKoreanEducationHanja · kRSUnicode · kTotalStrokes
- 원본: https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip

```text
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 1991-2026 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.
```

## 획순 — hanzi-writer-data-jp 0.8.0
획순 데이터: hanzi-writer-data-jp (animCJK · Make Me a Hanzi 기반) — Arphic Public License, LGPL-3.0
