/**
 * BSH CC Agent – Manual Privilege Recording
 *
 * Use this spec to manually navigate the app and capture which Dataverse API
 * calls (and therefore which privileges) your actions require.
 *
 * ─── HOW TO USE ───────────────────────────────────────────────────────────────
 * 1.  npm run test:record-manual
 * 2.  The browser opens at the Copilot Service workspace (already logged in).
 * 3.  The Playwright Inspector pauses the test.  Perform your steps freely.
 * 4.  Click  ▶ Resume  in the Inspector toolbar when you are done.
 * 5.  The privilege matrix is saved to the Playwright HTML report.
 *     Run:  npm run test:report  — then download "privilege-matrix.txt".
 *
 * ─── LABELLING STEPS ──────────────────────────────────────────────────────────
 * The report groups API calls by "step".  To label individual actions call the
 * helper  window.__pwRecordStep('My step name')  from the Inspector console,
 * then perform the related UI actions.  If you never call it all calls are
 * grouped under the default "Manual session" step.
 *
 * ─── OUTPUT ───────────────────────────────────────────────────────────────────
 *   privilege-matrix.txt  — entity × operation table + suggested prv* names
 *   privilege-raw-log.json — full per-request evidence log
 */

import { test } from '@playwright/test';
import { PrivilegeInterceptor } from './helpers/privilege-interceptor';

const APP_URL =
  process.env.D365_APP_URL ??
  'https://bsh-paramount-dev-cc.crm4.dynamics.com/main.aspx?appid=dd95518c-7091-f011-b4cb-7ced8d41a4a8';

test.use({ actionTimeout: 0 }); // no timeout while the user is navigating

test('Manual privilege recording session', async ({ page }, testInfo) => {
  test.setTimeout(0); // unlimited — user controls the session length
  // Navigate to the app (auth state already loaded from storageState)
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait for the app shell to be ready
  await page.waitForSelector(
    'div[data-id="navbar-container"], ul[data-id="tablist"], [data-id="MainLandMarkHeader"]',
    { timeout: 120_000 }
  );

  const interceptor = new PrivilegeInterceptor(page);

  // Expose a helper so the user can label steps from the browser console:
  //   window.__pwRecordStep('Open Case')
  await page.exposeFunction('__pwRecordStep', (stepName: string) => {
    interceptor.setStep(stepName);
    console.log(`  📍 Step set: "${stepName}"`);
  });

  interceptor.setStep('Manual session');

  console.log('\n─────────────────────────────────────────────────────────');
  console.log('  🎬 Recording started.  Perform your actions in the browser.');
  console.log('  💡 To label a step, run in the browser console:');
  console.log("       __pwRecordStep('My step name')");
  console.log('  ⏹  Click the red "Stop Recording" button in the page when done.');
  console.log('─────────────────────────────────────────────────────────\n');

  // Inject a floating "Stop Recording" button into the page.
  // The test waits until the user clicks it — no inspector overlay, no interference.
  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      const btn = document.createElement('button');
      btn.id = '__pw_stop_recording';
      btn.textContent = '⏹ Stop Recording';
      btn.style.cssText = [
        'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
        'padding:12px 22px', 'background:#c62828', 'color:#fff',
        'border:none', 'border-radius:6px', 'font-size:15px',
        'font-weight:bold', 'cursor:pointer',
        'box-shadow:0 4px 14px rgba(0,0,0,0.35)',
        'font-family:system-ui,sans-serif',
      ].join(';');
      btn.onmouseenter = () => { btn.style.background = '#b71c1c'; };
      btn.onmouseleave = () => { btn.style.background = '#c62828'; };
      btn.onclick = () => { btn.remove(); resolve(); };
      document.body.appendChild(btn);
    });
  });

  interceptor.detach();

  // ─── Build and attach reports ─────────────────────────────────────────────

  const matrix = interceptor.formatMatrix();
  const stepDetail = interceptor.stepTable();
  const fullText = matrix + '\n\nPER-STEP DETAIL:\n' + stepDetail;

  console.log('\n' + fullText);

  await testInfo.attach('privilege-matrix.txt', {
    body: Buffer.from(fullText),
    contentType: 'text/plain',
  });

  await testInfo.attach('privilege-raw-log.json', {
    body: Buffer.from(JSON.stringify(interceptor.rawLog(), null, 2)),
    contentType: 'application/json',
  });
});
