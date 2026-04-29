/**
 * Shared Microsoft 365 / Entra ID login helper for D365 auth setup.
 *
 * Handles the full corporate login flow including:
 *   • Email + password
 *   • TOTP / OTP code entry (automated if secret provided, manual otherwise)
 *   • Push-notification MFA  (waits for user approval – browser stays visible)
 *   • Number-match MFA       (prints the matching number, waits for approval)
 *   • "More information required" / extra security prompts
 *   • "Register your device" / company portal device prompts
 *   • "Accept Terms of Use"
 *   • "Stay signed in?" / KMSI
 *   • "Set up security info" / SSPR registration prompts
 *
 * MFA strategy
 * ────────────
 * If CC_AGENT_TOTP_SECRET (or D365_ADMIN_TOTP_SECRET) is set in .env the helper
 * will generate the 6-digit TOTP code automatically.
 *
 * If no secret is supplied, and a code-entry screen appears, the helper falls
 * back to MANUAL mode: it prints a clear prompt to the console and waits up
 * to MFA_WAIT_MS (default 120 s) for the user to approve on their device.
 * The browser window stays open and visible so the user can see the screen.
 */

import type { Page } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── TOTP (RFC 6238) ──────────────────────────────────────────────────────────

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a TOTP code from a Base32 secret (standard 6-digit, 30-second window). */
export function generateTOTP(secret: string, digits = 6, period = 30): string {
  const counter = Math.floor(Date.now() / 1000 / period);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

/** Returns seconds until the current TOTP window expires. */
function totpSecondsRemaining(period = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

// ─── Login options ────────────────────────────────────────────────────────────

export interface LoginOptions {
  d365Url: string;
  username: string;
  password: string;
  /** Base32-encoded TOTP secret (from the authenticator app QR code). Optional. */
  totpSecret?: string;
  /** Path to save the storageState JSON. */
  authFile: string;
  /** How long (ms) to wait for the user to approve a push-notification MFA. Default 120 000. */
  mfaWaitMs?: number;
  /**
   * Full URL of the D365 model-driven app to open after login.
   * Takes priority over appName. The storageState is saved AFTER the app loads.
   * Example: 'https://org.crm4.dynamics.com/main.aspx?appid=dd95518c-...'
   */
  appUrl?: string;
  /**
   * Display name of the D365 model-driven app to open after login (tile picker).
   * Ignored when appUrl is provided.
   * Example: 'Copilot Service workspace'
   */
  appName?: string;
}

// ─── Screen detection helpers ─────────────────────────────────────────────────

/** Wait for the first of several selectors to become visible. Returns the matched selector. */
async function waitForFirst(page: Page, selectors: string[], timeout: number): Promise<string | null> {
  const settled = await Promise.race(
    selectors.map(sel =>
      page
        .locator(sel)
        .first()
        .waitFor({ state: 'visible', timeout })
        .then(() => sel)
        .catch(() => null)
    )
  );
  return settled;
}

/** Returns true if the locator is currently visible (non-throwing). */
async function visible(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

// ─── Screen type tags ─────────────────────────────────────────────────────────

type Screen =
  | 'email'
  | 'password'
  | 'totp-input'
  | 'push-mfa'
  | 'number-match-mfa'
  | 'more-info-required'
  | 'device-registration'
  | 'terms-of-use'
  | 'sspr-setup'
  | 'stay-signed-in'
  | 'authenticated'
  | 'unknown';

async function detectScreen(page: Page, d365Host: string): Promise<Screen> {
  const url = page.url();

  // Already in D365 — treat any D365 URL as authenticated so the login loop
  // exits cleanly.  The app-list page (pagetype=apps) does NOT have a
  // navbar-container, so don't require it here; selectApp() handles that.
  if (url.includes(d365Host)) return 'authenticated';

  if (await visible(page, 'input[name="loginfmt"]')) return 'email';
  if (await visible(page, 'input[name="passwd"]')) return 'password';

  // TOTP / OTP code entry – Microsoft uses the `otc` field name
  if (await visible(page, 'input[name="otc"]')) return 'totp-input';

  // Number-match MFA (Microsoft Authenticator 2-digit challenge)
  if (await visible(page, '[data-testid="displaySign"]')) return 'number-match-mfa';

  // Push notification MFA – waiting for phone approval
  if (
    await visible(page, '#idDiv_SAOTCAS_Title') ||
    await visible(page, '[data-testid="ApproveMobileTitle"]') ||
    await visible(page, '.ext-phoneAppBodyContent') ||
    (await page.locator('text=/approve.*request|open.*authenticator|notification.*sent/i').first().isVisible().catch(() => false))
  ) return 'push-mfa';

  // "More information required" / "Set up your account"
  if (
    await visible(page, '#ProofUpDescription') ||
    (await page.locator('text=/more information required|additional security/i').first().isVisible().catch(() => false))
  ) return 'more-info-required';

  // "Register your device" / Company Portal / device management prompt
  if (
    (await page.locator('text=/register.*device|join.*organisation|join.*organization|this device is not managed/i').first().isVisible().catch(() => false)) ||
    (await page.locator('#btnAzureADJoin, #btnDontJoin, [id*="btnNoReg"]').first().isVisible().catch(() => false))
  ) return 'device-registration';

  // Terms of Use
  if (
    await visible(page, '#acceptButton') ||
    (await page.locator('text=/terms of use|accept.*terms/i').first().isVisible().catch(() => false))
  ) return 'terms-of-use';

  // SSPR / security-info setup ("Set up your security info", "Register for password reset")
  if (
    (await page.locator('text=/set up.*security|register.*password reset|sign in.*another way/i').first().isVisible().catch(() => false)) ||
    await visible(page, '#idBtnSetupSecurityInfo') ||
    await visible(page, '#KmsiCheckboxField') // sometimes appears on SSPR pages
  ) return 'sspr-setup';

  // "Stay signed in?" (KMSI)
  if (await visible(page, '#idBtn_Back') || await visible(page, '#idSIButton9')) {
    const title = await page.locator('#KmsiTitle, [data-testid="kmsi-page-title"]').first().isVisible().catch(() => false);
    if (title) return 'stay-signed-in';
    // Fallback: button #idBtn_Back is used exclusively for KMSI "No" button
    if (await visible(page, '#idBtn_Back')) return 'stay-signed-in';
  }

  return 'unknown';
}

// ─── Main login helper ────────────────────────────────────────────────────────

export async function loginToD365(page: Page, opts: LoginOptions): Promise<void> {
  const { d365Url, username, password, totpSecret, authFile, mfaWaitMs = 120_000 } = opts;
  const d365Host = new URL(d365Url).host;

  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  await page.goto(d365Url);
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // ── Step 1: email ────────────────────────────────────────────────────────────
  const emailInput = page.locator('input[name="loginfmt"]');
  if (await emailInput.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
    console.log('  📧 Filling email…');
    await emailInput.fill(username);
    await page.locator('[type="submit"]').click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1_000);
  }

  // ── Step 2: password ─────────────────────────────────────────────────────────
  const passInput = page.locator('input[name="passwd"]');
  if (await passInput.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
    console.log('  🔒 Filling password…');
    await passInput.fill(password);
    const signInBtn = page.locator('#idSIButton9');
    if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click();
    } else {
      await page.locator('[type="submit"]').click();
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1_000);
  }

  // ── Step 3: TOTP (automated if secret provided) ──────────────────────────────
  const totpInput = page.locator('input[name="otc"]');
  if (await totpInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    if (totpSecret) {
      const remaining = totpSecondsRemaining();
      if (remaining < 3) {
        console.log(`  ⏳ TOTP: waiting ${remaining + 1} s for next window…`);
        await new Promise(res => setTimeout(res, (remaining + 1) * 1_000));
      }
      const code = generateTOTP(totpSecret);
      console.log(`  🔑 Entering TOTP code: ${code}`);
      await totpInput.fill(code);
      await page.locator('#idSubmit_SAOTCC_Continue, [type="submit"]').first().click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    // If no secret — fall through to the manual-wait below
  }

  // ── Step 4: wait for the user to complete MFA + any remaining prompts ─────────
  // Print a clear prompt every 15 s so the user knows what's expected.
  // Poll every second until the browser's hostname matches D365.
  console.log('\n' + '═'.repeat(70));
  console.log('  📱  COMPLETE LOGIN IN THE BROWSER WINDOW');
  console.log('  Approve MFA, accept terms, click "No" on "Stay signed in?", etc.');
  console.log(`  Waiting up to ${Math.round(mfaWaitMs / 1_000)} s for D365 to load…`);
  console.log('═'.repeat(70) + '\n');

  const deadline = Date.now() + mfaWaitMs;
  let reached = false;
  while (Date.now() < deadline) {
    if (page.url().includes(d365Host)) { reached = true; break; }

    // Number-match MFA — print the number so the user can match it
    const numMatch = page.locator('[data-testid="displaySign"]').first();
    if (await numMatch.isVisible().catch(() => false)) {
      const num = await numMatch.textContent().catch(() => '?');
      console.log(`  📱  NUMBER MATCH: enter  ➜  ${num?.trim()}  ← in your Authenticator app`);
    }

    // "Stay signed in?" — click Yes to persist the session cookie longer
    const kmsiYes = page.locator('#idSIButton9');
    if (await kmsiYes.isVisible().catch(() => false)) {
      const kmsiTitle = await page.locator('#KmsiTitle').isVisible().catch(() => false);
      const kmsiBack  = await page.locator('#idBtn_Back').isVisible().catch(() => false);
      if (kmsiTitle || kmsiBack) {
        console.log('  ✅ "Stay signed in?" → clicking Yes');
        await kmsiYes.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
      }
    }

    // Terms of Use — accept automatically
    const acceptBtn = page.locator('#acceptButton');
    if (await acceptBtn.isVisible().catch(() => false)) {
      console.log('  ✅ Accepting Terms of Use…');
      await acceptBtn.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    await page.waitForTimeout(1_000);
  }

  if (!reached) {
    // Take a diagnostic screenshot before throwing
    const screenshotDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'login-timeout.png'), fullPage: true }).catch(() => {});
    throw new Error(
      `loginToD365: timed out waiting for ${d365Host} after ${Math.round(mfaWaitMs / 1_000)} s. ` +
      `Check test-results/login-timeout.png — the browser is at: ${page.url()}`
    );
  }

  console.log('  ✅ Reached D365');

  // ── Step 5: navigate to the target app ──────────────────────────────────────
  if (opts.appUrl) {
    console.log('  🚀 Navigating to app URL…');
    await page.goto(opts.appUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // App URL navigation may trigger another OAuth SSO reload — wait for the
    // hostname to settle back on D365 before checking the page is ready
    await page.waitForFunction(
      (host: string) => window.location.hostname === host,
      d365Host,
      { timeout: 120_000, polling: 1_000 }
    );
    // Wait for any recognisable D365 UCI element — different apps use different
    // shells (Copilot Service workspace omits navbar-container)
    await page.waitForSelector(
      [
        'div[data-id="navbar-container"]',   // classic UCI
        'ul[data-id="tablist"]',              // Copilot / CS workspace tab bar
        '[data-id="MainLandMarkHeader"]',     // UCI main header landmark
        'div[data-id="dashboard-container"]', // dashboard view
        'div.ms-Nav',                         // fluent nav
        '[aria-label="Home"]',               // Home nav item
      ].join(', '),
      { timeout: 120_000 }
    );
    console.log('  ✅ App loaded');
  } else if (opts.appName) {
    await selectApp(page, d365Url, opts.appName);
  } else {
    await page.waitForSelector(
      'div[data-id="navbar-container"], ul[data-id="tablist"], [data-id="MainLandMarkHeader"]',
      { timeout: 120_000 }
    );
  }

  await page.context().storageState({ path: authFile });
  console.log(`✅ Auth state saved → ${authFile}`);
}

// ─── App selection ────────────────────────────────────────────────────────────

/**
 * Open the D365 app switcher, find the named app, click it, and wait for
 * the UCI shell to fully reload inside that app's context.
 *
 * Call this BEFORE saving storageState so subsequent tests inherit the context.
 */
export async function selectApp(page: Page, d365Url: string, appName: string): Promise<void> {
  console.log(`  🚀 Selecting app: "${appName}"…`);

  // Navigate to the app-list page — the most reliable entry point
  await page.goto(`${d365Url}/main.aspx?forceUCI=1&pagetype=apps`);

  // Give the app grid time to fully render (D365 SPA; DOM is JS-driven)
  await page.waitForTimeout(5_000);

  // Dump the page URL + all visible text so we can diagnose selector mismatches
  const currentUrl = page.url();
  console.log(`  📍 App-list URL: ${currentUrl}`);

  // Collect the innerText of every element that could be an app tile, so we
  // can see EXACTLY what names are on screen and which selectors would work.
  const diagnostics = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll(
      '[data-id], [class*="app"], [class*="App"], li, button, a'
    ));
    return candidates
      .map(el => ({
        tag:      el.tagName,
        dataId:   el.getAttribute('data-id') ?? '',
        title:    el.getAttribute('title') ?? '',
        ariaLabel: el.getAttribute('aria-label') ?? '',
        text:     (el.textContent ?? '').trim().slice(0, 80),
        classes:  el.className.toString().slice(0, 80),
      }))
      .filter(e => e.text.length > 0 || e.title.length > 0)
      .slice(0, 50);   // cap output
  }).catch(() => []);
  console.log('  🔍 App-list DOM sample:', JSON.stringify(diagnostics, null, 2));

  // Take a screenshot so the developer can see what the page looks like
  const screenshotDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, 'app-list-debug.png'),
    fullPage: true,
  }).catch(() => {});

  // ── Attempt 1: attribute-based (fastest, most reliable when present) ─────────
  const attrSelectors = [
    `[title="${appName}"]`,
    `[aria-label="${appName}"]`,
    `[data-id*="appTile"][title="${appName}"]`,
    `[data-id*="appTile"][aria-label="${appName}"]`,
  ];
  for (const sel of attrSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      console.log(`  🎯 Found app via selector: ${sel}`);
      await el.click();
      await _waitForAppLoad(page, d365Url);
      console.log(`  ✅ App "${appName}" loaded`);
      return;
    }
  }

  // ── Attempt 2: text-content match across common container elements ───────────
  const textSelectors = [
    `button:has-text("${appName}")`,
    `a:has-text("${appName}")`,
    `li:has-text("${appName}")`,
    `div:has-text("${appName}")`,
    `span:has-text("${appName}")`,
  ];
  for (const sel of textSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      console.log(`  🎯 Found app via text selector: ${sel}`);
      await el.click();
      await _waitForAppLoad(page, d365Url);
      console.log(`  ✅ App "${appName}" loaded`);
      return;
    }
  }

  // ── Attempt 3: evaluate-click — find ANY element whose text includes the name ─
  const clicked = await page.evaluate((name) => {
    const all = Array.from(document.querySelectorAll('*'));
    const target = all.find(el => {
      const t = (el.textContent ?? '').trim();
      return t === name || t.startsWith(name);
    }) as HTMLElement | undefined;
    if (target) { target.click(); return true; }
    return false;
  }, appName);

  if (clicked) {
    console.log(`  🎯 Found app via evaluate-click`);
    await _waitForAppLoad(page, d365Url);
    console.log(`  ✅ App "${appName}" loaded`);
    return;
  }

  // ── No match found — throw with context to help diagnosis ───────────────────
  throw new Error(
    `selectApp: could not find app tile for "${appName}". ` +
    `Check test-results/app-list-debug.png and the diagnostic log above.`
  );
}

async function _waitForAppLoad(page: Page, d365Url: string): Promise<void> {
  await page.waitForURL(`${d365Url}/**`, { timeout: 30_000 });
  await page.waitForSelector(
    'div[data-id="navbar-container"], ul[data-id="tablist"], [data-id="MainLandMarkHeader"]',
    { timeout: 120_000 }
  );
  await page.waitForLoadState('networkidle').catch(() => {});
}
