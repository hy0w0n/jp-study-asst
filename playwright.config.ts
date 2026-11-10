import { defineConfig, devices } from "@playwright/test";

// 모바일 E2E (규약: .claude/skills/testing). 3000은 다른 앱, 3001은 dev 서버가 쓰므로 3200에서 프로덕션 빌드를 띄운다.
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // 획순 데이터는 외부 CDN에서 받는다 — CI에서는 일시적인 네트워크 실패만 한 번 더 본다
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile",
      // iPhone 13 에뮬(터치·UA·배율)에 앱 기준 뷰포트 375×812. CI는 chromium만 설치한다
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
