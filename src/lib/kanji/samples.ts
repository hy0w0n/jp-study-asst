// 사전 데이터 샘플 13자의 기대값. 빌드 검증(scripts/build-kanji-data.ts)과 vitest가 같이 쓴다.
// 기대값은 Unihan 18.0 원본(kJapaneseOldVariant·kIRG_KSource·kHangul)에서 손으로 확인했다.
import type { KoDiff } from "./data";

export const KO_FORM_SAMPLES: Record<string, { forms: string[]; diff: KoDiff; koReading: string[] }> = {
  学: { forms: ["學"], diff: "form", koReading: ["학"] },
  職: { forms: ["職"], diff: "same", koReading: ["직"] },
  教: { forms: ["敎"], diff: "form", koReading: ["교"] },
  楽: { forms: ["樂"], diff: "form", koReading: ["악", "락"] },
  直: { forms: ["直"], diff: "same", koReading: ["직"] }, // 코드포인트는 같고 글꼴만 다르다
  青: { forms: ["靑"], diff: "form", koReading: ["청"] },
  真: { forms: ["眞"], diff: "form", koReading: ["진"] },
  国: { forms: ["國"], diff: "form", koReading: ["국"] },
  読: { forms: ["讀"], diff: "form", koReading: ["독"] },
  売: { forms: ["賣"], diff: "form", koReading: ["매"] },
  気: { forms: ["氣"], diff: "form", koReading: ["기"] },
  円: { forms: ["圓"], diff: "form", koReading: ["원"] }, // 円 자신도 KS X 1001(엔)에 있지만 한국은 圓을 쓴다
  図: { forms: ["圖"], diff: "form", koReading: ["도"] },
};
