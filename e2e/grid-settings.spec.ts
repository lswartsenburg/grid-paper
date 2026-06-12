import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clears the IndexedDB documents store and localStorage so each test starts
 * with default grid settings. Uses a readwrite transaction on the existing
 * connection — `deleteDatabase` blocks when the page already has the DB open.
 */
async function clearStorage(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('grid-paper', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        // Handle first-time open — store may not exist yet.
        req.onupgradeneeded = (e) => {
          const database = (e.target as IDBOpenDBRequest).result;
          if (!database.objectStoreNames.contains('documents')) {
            database.createObjectStore('documents', { keyPath: 'id' });
          }
        };
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // DB didn't exist yet — that's fine, nothing to clear.
    }
  });
}

/** Opens the Grid Settings popover and waits for the heading to appear. */
async function openGridSettings(page: Page) {
  await page.getByTitle('Grid settings').click();
  await expect(page.getByText('GRID SETTINGS')).toBeVisible();
}

/** Locates the Major-line-every number input inside the open popover. */
function majorLineInput(page: Page) {
  return page
    .locator('label')
    .filter({ hasText: 'Major line every' })
    .locator('input[type="number"]');
}

/** Locates the Cell-size number input inside the open popover. */
function cellSizeInput(page: Page) {
  return page
    .locator('label')
    .filter({ hasText: 'Cell size' })
    .locator('input[type="number"]');
}

/**
 * Reads the gridConfig of the most recently modified document from IndexedDB.
 * Sorting by `updatedAt` desc ensures we read the doc the app is actually
 * using, not a stale duplicate left by React StrictMode's double-invoke.
 * Returns null if no document is stored yet.
 */
async function readGridConfigFromDB(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('grid-paper', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const docs = await new Promise<
      { gridConfig: Record<string, unknown>; updatedAt: string }[]
    >((resolve, reject) => {
      const req = db
        .transaction('documents', 'readonly')
        .objectStore('documents')
        .getAll();
      req.onsuccess = () =>
        resolve(
          req.result as {
            gridConfig: Record<string, unknown>;
            updatedAt: string;
          }[]
        );
      req.onerror = () => reject(req.error);
    });
    // Sort descending by updatedAt so we always read the most-recently-changed doc.
    docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return docs[0]?.gridConfig ?? null;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
//
// Run serially so tests share a single IndexedDB connection cleanly and don't
// race each other when clearing or writing documents.

test.describe.serial('grid settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully initialize so any in-flight DB writes from the
    // previous test complete before clearStorage runs.
    await page.getByTitle('Grid settings').waitFor({ timeout: 10_000 });
    await clearStorage(page);
    await page.reload();
    // Wait for CanvasEditor to mount and the initial useStorageAdapter save to
    // commit before the test starts — prevents a late initial-save from racing
    // against the test's own DB writes.
    await page.getByTitle('Grid settings').waitFor({ timeout: 10_000 });
    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 5_000 })
      .not.toBeNull();
  });

  // ── Popover open / close ──────────────────────────────────────────────────

  test('popover is hidden on load and opens on grid icon click', async ({
    page,
  }) => {
    await expect(page.getByText('GRID SETTINGS')).not.toBeVisible();
    await openGridSettings(page);
    await expect(page.getByText('GRID SETTINGS')).toBeVisible();
  });

  test('popover closes when clicking outside', async ({ page }) => {
    await openGridSettings(page);
    // Click the canvas area, away from the popover.
    await page.mouse.click(700, 350);
    await expect(page.getByText('GRID SETTINGS')).not.toBeVisible();
  });

  // ── Default state ─────────────────────────────────────────────────────────

  test('default state shows no cell-size row and no scale pill', async ({
    page,
  }) => {
    await openGridSettings(page);
    await expect(page.getByText(/Cell size/)).not.toBeVisible();
    await expect(page.getByText(/1 cell =/)).not.toBeVisible();
  });

  test('default snap-to-grid checkbox is checked', async ({ page }) => {
    await openGridSettings(page);
    await expect(
      page.getByRole('checkbox', { name: 'Snap to grid' })
    ).toBeChecked();
  });

  test('default major-line value is 5', async ({ page }) => {
    await openGridSettings(page);
    await expect(majorLineInput(page)).toHaveValue('5');
  });

  // ── Unit selector ─────────────────────────────────────────────────────────

  test('dropdown contains all supported units', async ({ page }) => {
    await openGridSettings(page);
    const combo = page.getByRole('combobox');
    for (const unit of ['mm', 'cm', 'm', 'in', 'ft', 'yd']) {
      await expect(combo.locator(`option[value="${unit}"]`)).toHaveCount(1);
    }
  });

  test('selecting a unit reveals the cell-size row and scale pill', async ({
    page,
  }) => {
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('cm');

    await expect(page.getByText('Cell size (cm/cell)')).toBeVisible();
    await expect(page.getByText('1 cell = 1 cm')).toBeVisible();
  });

  test('switching back to None hides the cell-size row and scale pill', async ({
    page,
  }) => {
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('ft');
    await expect(page.getByText('1 cell = 1 ft')).toBeVisible();

    await page.getByRole('combobox').selectOption('');
    await expect(page.getByText(/Cell size/)).not.toBeVisible();
    await expect(page.getByText(/1 cell =/)).not.toBeVisible();
  });

  // ── Cell size ─────────────────────────────────────────────────────────────

  test('cell size input updates the scale pill in real time', async ({
    page,
  }) => {
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('m');
    await expect(page.getByText('1 cell = 1 m')).toBeVisible();

    const input = cellSizeInput(page);
    await input.click({ clickCount: 3 });
    await input.pressSequentially('5');
    await input.press('Tab');

    await expect(page.getByText('1 cell = 5 m')).toBeVisible();
  });

  // ── Snap to grid ──────────────────────────────────────────────────────────

  test('unchecking snap-to-grid saves false to IndexedDB', async ({ page }) => {
    await openGridSettings(page);
    const checkbox = page.getByRole('checkbox', { name: 'Snap to grid' });
    await checkbox.uncheck();
    // Verify the UI changed before polling the DB.
    await expect(checkbox).not.toBeChecked();

    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 3000 })
      .toMatchObject({ snapToGrid: false });
  });

  test('re-checking snap-to-grid saves true to IndexedDB', async ({ page }) => {
    await openGridSettings(page);
    const checkbox = page.getByRole('checkbox', { name: 'Snap to grid' });
    await checkbox.uncheck();
    await checkbox.check();

    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 3000 })
      .toMatchObject({ snapToGrid: true });
  });

  // ── Persistence across reloads ────────────────────────────────────────────

  test('major-line every persists across reload', async ({ page }) => {
    await openGridSettings(page);
    const input = majorLineInput(page);
    await input.click({ clickCount: 3 });
    await input.pressSequentially('8');
    await input.press('Tab');

    // Verify the input accepted the value before reloading.
    await expect(majorLineInput(page)).toHaveValue('8');
    // Wait for auto-save.
    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 3000 })
      .toMatchObject({ majorEvery: 8 });

    await page.reload();

    await openGridSettings(page);
    await expect(majorLineInput(page)).toHaveValue('8');
  });

  test('selected unit persists across reload', async ({ page }) => {
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('in');
    await expect(page.getByText('1 cell = 1 in')).toBeVisible();

    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 3000 })
      .toMatchObject({ unit: 'in' });

    await page.reload();

    // Scale pill must be visible immediately — no need to open the popover.
    await expect(page.getByText('1 cell = 1 in')).toBeVisible();
  });

  test('unit and cell size together persist across reload', async ({
    page,
  }) => {
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('ft');

    const input = cellSizeInput(page);
    await expect(input).toBeVisible();
    await input.click({ clickCount: 3 });
    await input.pressSequentially('12');
    await input.press('Tab');

    await expect(page.getByText('1 cell = 12 ft')).toBeVisible();
    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 3000 })
      .toMatchObject({ unit: 'ft', cellSize: 12 });

    await page.reload();

    await expect(page.getByText('1 cell = 12 ft')).toBeVisible();
  });

  test('snap-to-grid disabled state persists across reload', async ({
    page,
  }) => {
    await openGridSettings(page);
    await page.getByRole('checkbox', { name: 'Snap to grid' }).uncheck();

    await expect
      .poll(() => readGridConfigFromDB(page), { timeout: 3000 })
      .toMatchObject({ snapToGrid: false });

    await page.reload();

    await openGridSettings(page);
    await expect(
      page.getByRole('checkbox', { name: 'Snap to grid' })
    ).not.toBeChecked();
  });

  // ── YAML round-trip ───────────────────────────────────────────────────────

  test('default settings produce no grid block in YAML', async ({ page }) => {
    await page.getByTitle('YAML').click();
    const yaml = await page.locator('textarea').inputValue();
    expect(yaml).not.toContain('grid:');
  });

  test('non-default unit appears in YAML output', async ({ page }) => {
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('in');
    await page.mouse.click(700, 350); // close popover

    await page.getByTitle('YAML').click();
    await expect(page.locator('textarea')).toContainText('unit: "in"');
  });

  test('non-default majorEvery appears in YAML output', async ({ page }) => {
    await openGridSettings(page);
    const input = majorLineInput(page);
    await input.click({ clickCount: 3 });
    await input.pressSequentially('4');
    await input.press('Tab');
    await page.mouse.click(700, 350); // close popover

    await page.getByTitle('YAML').click();
    await expect(page.locator('textarea')).toContainText('majorEvery: 4');
  });

  test('snapToGrid: false appears in YAML when disabled', async ({ page }) => {
    await openGridSettings(page);
    await page.getByRole('checkbox', { name: 'Snap to grid' }).uncheck();
    await page.mouse.click(700, 350); // close popover

    await page.getByTitle('YAML').click();
    await expect(page.locator('textarea')).toContainText('snapToGrid: false');
  });

  test('editing unit in YAML updates the scale pill', async ({ page }) => {
    // Set a unit via the popover first so the grid block exists.
    await openGridSettings(page);
    await page.getByRole('combobox').selectOption('cm');
    await page.mouse.click(700, 350);
    await expect(page.getByText('1 cell = 1 cm')).toBeVisible();

    await page.getByTitle('YAML').click();
    const textarea = page.locator('textarea');
    await expect(textarea).toContainText('unit: "cm"');

    // Replace "cm" with "ft" directly in the YAML.
    const current = await textarea.inputValue();
    await textarea.fill(current.replace('unit: "cm"', 'unit: "ft"'));
    await textarea.press('Tab'); // trigger apply

    await expect(page.getByText('1 cell = 1 ft')).toBeVisible();
  });
});
