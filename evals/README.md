# evals/

- `kanji-truth.json` — 정답 셋 59자 (KANJIDIC2 3.6.2 · 2026-10-26, CC BY-SA 4.0). 필드: on · kun(`まな.ぶ` 형식, `.` 뒤가 오쿠리가나) · korean_h · korean_r · meanings_en · jlpt_old(구 4단계) · grade · strokes · freq
  - 취업·일상 한자(履歴書·面接·職·就活·開発·情報…) + 자형 차이 까다로운 글자(国·読·売·気·円·図·旧·体·説·青·真·為·即·戸·概·況·温·効)
- `promptfooconfig.example.yaml` — promptfoo로 모델·프롬프트 비교할 때 복사해서 사용
- `results/` — `npm run eval:kanji` 결과 JSON (git에 남긴다)
- `failures/` — 실패 사례 메모 (프롬프트·검증 개선 재료)
- `.cache/` — JMdict 단어 후보 캐시 (gitignore)

자세한 절차는 `.claude/skills/ai-eval/SKILL.md`.
