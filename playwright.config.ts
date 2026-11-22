import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/frontend',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    },
  },
  webServer: [
    { command: 'npm run dev -- --port 3100 --strictPort', url: 'http://127.0.0.1:3100',
      env: { VITE_PROFILE_API_BASE_URL: '/api/intelligence/profiles', VITE_AUTH_API_BASE_URL: '/api/auth', VITE_PATIENT_API_BASE_URL: '/api/intelligence/patient', VITE_CONSULTANT_API_BASE_URL: '/api/intelligence/consultant' }, reuseExistingServer: false },
    { command: 'npm run dev -- --port 3101 --strictPort', url: 'http://127.0.0.1:3101',
      env: { VITE_AUTH_API_BASE_URL: '' }, reuseExistingServer: false },
  ],
});
