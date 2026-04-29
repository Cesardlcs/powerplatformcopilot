import { Page } from '@playwright/test';

const D365_URL = process.env.D365_URL ?? '';

/**
 * Navigate to a D365 entity list and wait until the UCI shell and Xrm object
 * are fully initialised.  Prefers a quick bailout when already on a D365 page.
 */
export async function goToEntityList(page: Page, entityLogicalName: string): Promise<void> {
  await page.goto(
    `${D365_URL}/main.aspx?forceUCI=1&pagetype=entitylist&etn=${entityLogicalName}`
  );
  await waitForXrm(page);
  // Wait for the grid container or "no-records" indicator – not networkidle
  await page
    .locator('.wj-flexgrid, [data-id="no-records-message"]')
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {
      // Grid may render differently; Xrm availability is the authoritative signal
    });
}

/**
 * Open a specific record form and wait for the form header to load.
 */
export async function goToRecord(
  page: Page,
  entityLogicalName: string,
  recordId: string
): Promise<void> {
  await page.goto(
    `${D365_URL}/main.aspx?forceUCI=1&pagetype=entityrecord&etn=${entityLogicalName}&id=${recordId}`
  );
  await waitForXrm(page);
  await page
    .locator('[data-id="header_title"]')
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {});
}

/**
 * Wait until window.Xrm is available and WebApi is ready.
 */
export async function waitForXrm(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as any).Xrm?.WebApi?.createRecord === 'function',
    { timeout: 45_000 }
  );
}

// ─── Typed wrappers for Xrm.WebApi ───────────────────────────────────────────

export interface ApiResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function xrmCreate(
  page: Page,
  entityName: string,
  data: Record<string, unknown>
): Promise<ApiResult> {
  return page.evaluate(
    async ([entity, record]) => {
      try {
        const result = await (window as any).Xrm.WebApi.createRecord(entity, record);
        return { success: true, id: result.id as string };
      } catch (err: any) {
        return { success: false, error: String(err?.message ?? err) };
      }
    },
    [entityName, data] as [string, Record<string, unknown>]
  );
}

export async function xrmUpdate(
  page: Page,
  entityName: string,
  id: string,
  data: Record<string, unknown>
): Promise<ApiResult> {
  return page.evaluate(
    async ([entity, recordId, record]) => {
      try {
        await (window as any).Xrm.WebApi.updateRecord(entity, recordId, record);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: String(err?.message ?? err) };
      }
    },
    [entityName, id, data] as [string, string, Record<string, unknown>]
  );
}

export async function xrmDelete(
  page: Page,
  entityName: string,
  id: string
): Promise<ApiResult> {
  return page.evaluate(
    async ([entity, recordId]) => {
      try {
        await (window as any).Xrm.WebApi.deleteRecord(entity, recordId);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: String(err?.message ?? err) };
      }
    },
    [entityName, id] as [string, string]
  );
}

export async function xrmRetrieve(
  page: Page,
  entityName: string,
  options = '?$top=5'
): Promise<{ success: boolean; count: number; error?: string }> {
  return page.evaluate(
    async ([entity, opts]) => {
      try {
        const result = await (window as any).Xrm.WebApi.retrieveMultipleRecords(entity, opts);
        return { success: true, count: (result.entities as unknown[]).length };
      } catch (err: any) {
        return { success: false, count: 0, error: String(err?.message ?? err) };
      }
    },
    [entityName, options] as [string, string]
  );
}

/** Returns true when the privilege error message is detected in the error string. */
export function isPrivilegeError(error: string | undefined): boolean {
  if (!error) return false;
  return /0x8004022|privilege|permission|access.?denied|not.?authorized|insufficient/i.test(error);
}

/** Retrieve the primary-key value of the first matching record. */
export async function xrmRetrieveFirstId(
  page: Page,
  entityName: string,
  idAttribute: string,
  options = '?$top=1'
): Promise<{ success: boolean; id?: string; error?: string }> {
  return page.evaluate(
    async ([entity, attr, opts]) => {
      try {
        const r = await (window as any).Xrm.WebApi.retrieveMultipleRecords(
          entity,
          `${opts}&$select=${attr}`
        );
        const first = (r.entities as Record<string, unknown>[])[0];
        return { success: true, id: first ? (first[attr] as string) : undefined };
      } catch (err: unknown) {
        return { success: false, error: String((err as Error)?.message ?? err) };
      }
    },
    [entityName, idAttribute, options] as [string, string, string]
  );
}

/**
 * Check whether the "Delete" command is visible in the command bar
 * (including the overflow "More commands" flyout).
 */
export async function isDeleteCommandVisible(page: Page): Promise<boolean> {
  // First check the visible bar
  const directBtn = page.locator('button[aria-label="Delete"]').first();
  if (await directBtn.isVisible({ timeout: 3_000 }).catch(() => false)) return true;

  // Open the overflow menu if present
  const overflow = page.locator('button[aria-label="More commands"], button[aria-label="More"]');
  if (await overflow.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
    await overflow.first().click();
    await page.waitForTimeout(500);
    const overflowDelete = page.locator(
      '[role="menu"] button[aria-label="Delete"], [role="menu"] li[aria-label="Delete"]'
    );
    const found = await overflowDelete.first().isVisible({ timeout: 2_000 }).catch(() => false);
    // Close overflow by pressing Escape
    await page.keyboard.press('Escape');
    if (found) return true;
  }

  return false;
}

/**
 * Check whether the "New" command is visible in the entity list command bar.
 */
export async function isNewCommandVisible(page: Page): Promise<boolean> {
  const btn = page.locator('button[aria-label="New"], button[data-id="new"]').first();
  return btn.isVisible({ timeout: 5_000 }).catch(() => false);
}
