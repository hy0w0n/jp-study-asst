import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 단위 테스트는 src/lib의 순수 함수만 (규약: .claude/skills/testing). E2E는 e2e/ + Playwright.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/lib/__stubs__/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
