import { defineConfig, devices } from '@playwright/test';

// Por defecto prueba producción; usa E2E_BASE_URL=http://localhost:3000 para probar en local.
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://mi-proyecto-fullstack-navy.vercel.app',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
