import { test as setup } from '@playwright/test';
import path from 'path';
import { loginToD365 } from './helpers/login';

const authFile = path.join(__dirname, '../.auth/admin.json');

setup('authenticate as Admin', async ({ page }) => {
  const d365Url = process.env.D365_URL!;
  const username = process.env.D365_ADMIN_USERNAME!;
  const password = process.env.D365_ADMIN_PASSWORD!;

  if (!d365Url || !username || !password) {
    throw new Error(
      'Missing required env vars: D365_URL, D365_ADMIN_USERNAME, D365_ADMIN_PASSWORD. See .env.example.'
    );
  }

  await loginToD365(page, {
    d365Url,
    username,
    password,
    totpSecret: process.env.D365_ADMIN_TOTP_SECRET,
    appUrl: process.env.D365_APP_URL,
    authFile,
  });
});
