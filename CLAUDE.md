@AGENTS.md

<!-- BEGIN:jp-hackathon-kit -->
## Claude Code 전용
- 파일 3개 이상을 바꾸는 작업은 먼저 짧은 계획(바꿀 파일·순서·확인 방법)을 보여주고 시작한다. 큰 이슈는 Plan 모드.
- 오래 걸리는 조사·넓은 검색은 서브에이전트에 맡기고 결론만 받는다. 리뷰·UX 점검·정확도 감사는 전용 에이전트(reviewer · ux-tester · accuracy-auditor)를 쓴다.
- 훅이 있다: 파일 수정 직후 ESLint, 턴 종료·작업 완료 시 타입 검사, `git commit` 전 `npm run check`. 훅이 막으면 우회하지 말고 고친다.
- 이슈 하나가 끝나면 PR까지 만들고 사용자에게 `/clear`를 권한다. 맥락은 이슈·PR·docs에 있다. 긴 작업을 넘길 때는 `/handoff`.
- 사용자가 화면 스크린샷을 붙이면 그 화면 기준으로만 고친다.
- 토큰을 효율적으로 쓴다: 필요한 파일만 열고, 긴 로그는 파일로 저장해 필요한 부분만 읽고, 답변은 결과 위주로 짧게.
- 에이전트 팀(`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)은 사용자가 켠 세션에서만 쓴다. 팀원끼리 같은 파일을 고치지 않도록 파일 집합을 나눠 준다.
<!-- END:jp-hackathon-kit -->
