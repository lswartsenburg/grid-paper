import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns center coordinates of rect-shaped selection handles (for rect/circle). */
async function getRectHandles(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg rect')]
      .filter(
        (r) =>
          r.getAttribute('stroke') === 'rgb(59,130,246)' &&
          r.getAttribute('fill') === 'white'
      )
      .map((r) => {
        const { x, y, width, height } = r.getBoundingClientRect();
        return { cx: x + width / 2, cy: y + height / 2 };
      })
  );
}

/** Counts all drawn rect shapes (fill="transparent", width/height > 20px). */
async function countDrawnRects(page: Page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('svg rect')].filter((r) => {
        const fill = r.getAttribute('fill');
        const { width, height } = r.getBoundingClientRect();
        return fill === 'transparent' && width > 20 && height > 20;
      }).length
  );
}

async function drawRect(
  page: Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 10 });
  await page.mouse.up();
}

// ─── Delete action ────────────────────────────────────────────────────────────

test.describe('delete shape action', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * The delete button in the PropertiesPanel removes the selected shape and
   * hides the panel (no shape selected).
   */
  test('clicking the delete button removes the shape', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);

    // Select the shape.
    await page.getByTitle('Select').click();
    await page.mouse.click(cx - 80 + 2, cy);

    await expect
      .poll(() => getRectHandles(page), { timeout: 3000 })
      .toHaveLength(4);

    expect(await countDrawnRects(page)).toBe(1);

    // Click the delete button in the properties panel.
    await page.getByTitle('Delete shape').click();

    // Shape must be gone.
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(0);

    // Handles disappear along with the shape.
    expect(await getRectHandles(page)).toHaveLength(0);
  });

  /** Deletion via the button is a single undo step. */
  test('deletion via button is undoable', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);

    await page.getByTitle('Select').click();
    await page.mouse.click(cx - 80 + 2, cy);

    await expect
      .poll(() => getRectHandles(page), { timeout: 3000 })
      .toHaveLength(4);

    await page.getByTitle('Delete shape').click();
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(0);

    await page.keyboard.press('Control+z');

    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(1);
  });
});

// ─── Duplicate action ─────────────────────────────────────────────────────────

test.describe('duplicate shape action', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Clicking the duplicate button creates an offset copy of the selected shape.
   * The new copy is selected immediately (handles appear on it).
   */
  test('clicking the duplicate button creates an offset copy', async ({
    page,
  }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);

    // Select the shape.
    await page.getByTitle('Select').click();
    await page.mouse.click(cx - 80 + 2, cy);

    await expect
      .poll(() => getRectHandles(page), { timeout: 3000 })
      .toHaveLength(4);

    expect(await countDrawnRects(page)).toBe(1);

    // Duplicate it.
    await page.getByTitle('Duplicate shape').click();

    // Two shapes must now be on the canvas.
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(2);
  });

  /**
   * The duplicate has no key even if the original did, to avoid key collisions.
   */
  test('duplicate does not copy the key', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);

    await page.getByTitle('Select').click();
    await page.mouse.click(cx - 80 + 2, cy);

    await expect
      .poll(() => getRectHandles(page), { timeout: 3000 })
      .toHaveLength(4);

    // Assign a key to the original shape.
    const keyInput = page.getByTitle(
      'Unique key for this shape (used in YAML and data-key attribute)'
    );
    await keyInput.fill('original');
    await keyInput.press('Enter');
    await expect(page.locator('[data-key="original"]')).toBeVisible();

    // Duplicate — the copy must not have the same key.
    await page.getByTitle('Duplicate shape').click();

    // Only one element with key "original" must exist.
    await expect(page.locator('[data-key="original"]')).toHaveCount(1);
  });
});
