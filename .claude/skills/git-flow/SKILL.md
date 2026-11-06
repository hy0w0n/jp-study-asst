---
name: git-flow
description: Git·GitHub·Vercel 배포 관리. 저장소 연결, 브랜치, 커밋, 푸시, 배포 상태 확인, 되돌리기가 필요할 때 사용. "커밋", "푸시", "배포", "브랜치", "되돌려", "깃", "깃허브", "버셀" 요청에 사용.
---

# Git Flow (1인 해커톤용)

원칙: **main은 항상 배포 가능**. 작게 자주 커밋. push = Vercel 배포.

## 최초 1회
1. `git status`로 저장소 상태 확인 (create-next-app이 이미 `git init` 해 둠).
2. `.gitignore` 확인: `.env*`가 무시되고 `!.env.example` 예외가 있는지. `.env.local`이 추적되고 있으면 **즉시 멈추고** 사용자에게 알린다.
3. GitHub 원격 연결
   - `gh auth status`가 성공하면: `gh repo create <이름> --private --source=. --remote=origin --push`
   - 아니면: 사용자에게 GitHub에서 빈 저장소를 만들고 URL을 달라고 요청 → `git remote add origin <URL>` → `git push -u origin main`
4. Vercel 연결은 사용자가 대시보드에서 Import 한다 (환경 변수 붙여넣기 포함). 연결 후 Vercel MCP로 첫 배포가 Ready인지 확인한다.

## 기능 단위 흐름
1. `git switch -c feat/<짧은-이름>` (예: `feat/kanji-stroke`)
2. 구현 → `npm run build` 통과 확인
3. 커밋 메시지: `<type>: <한국어 요약>` — type은 feat / fix / style / refactor / docs / chore
   - 예: `feat: 한자 획순 따라쓰기 모드 추가`
4. `git push -u origin feat/<이름>` → Vercel 미리보기 URL을 사용자에게 전달 (폰으로 바로 테스트). URL·상태는 Vercel MCP로 조회.
5. 사용자 OK → `git switch main && git merge --no-ff feat/<이름> && git push` → 프로덕션 배포 Ready 확인.
6. 배포 실패 시 Vercel MCP로 빌드 로그를 읽고 원인을 3줄로 요약한 뒤 수정한다.

시간이 아주 급하면(체크포인트 이후) 브랜치 없이 main에 작은 커밋 + 즉시 push 해도 된다. 단 build 통과는 필수.

## 안전장치
- 위험한 변경 전: `git tag checkpoint-<HHMM>`
- 되돌리기: 커밋 전이면 `git restore <파일>`, 커밋 후면 `git revert <sha>`. reset --hard / force push 금지.
- 커밋 전 `git diff --staged`에 키·토큰처럼 보이는 문자열이 없는지 확인.
- 미리보기 배포가 환경 변수 없이 깨지면: Vercel 프로젝트 Settings → Environment Variables에서 Preview에도 체크하도록 사용자에게 안내.
- 발표 직전: `git tag demo-final` 후 main 동결. 이후 수정은 사용자 확인 필수.
