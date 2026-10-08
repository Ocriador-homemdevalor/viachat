import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'local',
      testMatch: /(?:^|\/)(?:app|settings)\.spec\.ts/,
      use: { baseURL: 'http://127.0.0.1:5173' },
    },
    {
      name: 'cloud',
      testMatch: /cloud(?:-settings)?\.spec\.ts/,
      use: { baseURL: 'http://127.0.0.1:5174' },
    },
    {
      name: 'invalid',
      testMatch: /invalid-config\.spec\.ts/,
      use: { baseURL: 'http://127.0.0.1:5175' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_BASE_PATH: '/' },
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_public_key',
        VITE_BASE_PATH: '/',
      },
    },
    {
      command: 'npm run dev -- --port 5175 --strictPort',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_BASE_PATH: '/',
      },
    },
  ],
})
