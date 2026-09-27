import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 配置
 * - 起 dev server（CI 无需先 build，直接跑）
 * - 浏览器验收脚本 scripts/verify-core.mjs / verify-loop.mjs 的选择器策略在此沉淀
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'pnpm preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
})
