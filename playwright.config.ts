import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // D365 tests are order-dependent and share state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.D365_URL,
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    launchOptions: {
      // Force Chromium to use the system DNS resolver.
      // Chromium's built-in async resolver sometimes fails on corporate networks
      // where DNS is provided via VPN split-tunnel or a custom resolver.
      args: ['--dns-prefetch-disable'],
    },
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      timeout: 600_000, // 10 min — MFA requires human interaction
      use: { headless: false },
    },
    {
      name: 'setup-admin',
      testMatch: '**/auth.setup.admin.ts',
      timeout: 600_000, // 10 min — MFA requires human interaction
      use: { headless: false },
    },
    {
      name: 'cc-agent-validating',
      testMatch: '**/cc-agent-validating.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/cc-agent.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'cc-agent-scenario',
      testMatch: '**/cc-agent-scenario.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/cc-agent.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'admin-recording',
      testMatch: '**/admin-recording.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['setup-admin'],
    },
    {
      name: 'manual-recording',
      testMatch: '**/manual-recording.spec.ts',
      timeout: 0, // no timeout — user controls the session length
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/admin.json',
        headless: false,
      },
      dependencies: ['setup-admin'],
    },
  ],

  reporter: [['html', { open: 'never' }], ['list']],
});
