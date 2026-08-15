import { defineConfig, devices } from '@playwright/test'

// Isolated ports (admin's pattern): never reuse the developer's :3200 dev
// server — e2e must test a real production build against the deterministic
// stub API, not stale/in-progress dev output.
const apiPort = 3210
const webPort = 3211
const baseURL = `http://127.0.0.1:${webPort}`
const apiURL = `http://127.0.0.1:${apiPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `pnpm exec tsx e2e/stub-api.ts`,
      url: `${apiURL}/v1/platform/config`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { ...process.env, STUB_API_PORT: String(apiPort) },
    },
    {
      // NEXT_PUBLIC_* is inlined at BUILD time, so the stub URL must be in the
      // env of the build, not just the start.
      command: `pnpm build && pnpm exec next start -p ${webPort}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_APP_ENV: 'development',
        NEXT_PUBLIC_API_URL: apiURL,
        NEXT_PUBLIC_WEB_URL: baseURL,
      },
    },
  ],
})
