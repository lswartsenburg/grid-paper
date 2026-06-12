import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Counts SVG rects that belong to drawn shapes (fill="transparent"). */
async function countDrawnRects(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelectorAll('svg rect[fill="transparent"]').length
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

/**
 * The Next.js dev-overlay portal sits at the bottom-left and intercepts native
 * pointer events over the undo/redo buttons. Clicking via JS bypasses this.
 */
async function jsClick(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLButtonElement | null;
    if (el) el.click();
  }, selector);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('history buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Clicking the ↺ undo button should remove the last drawn shape.
   * The button must be disabled when there is nothing to undo.
   */
  test('undo button removes the last drawn shape', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    const beforeCount = await countDrawnRects(page);

    // Undo must be disabled before any drawing.
    await expect(page.locator('[title="Undo (⌘Z)"]')).toBeDisabled();

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(
      beforeCount + 1
    );

    // Undo must become enabled after a shape is added.
    await expect(page.locator('[title="Undo (⌘Z)"]')).not.toBeDisabled();

    // Use JS click to bypass the Next.js dev-overlay portal interception.
    await jsClick(page, '[title="Undo (⌘Z)"]');
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(
      beforeCount
    );
  });

  /**
   * After undoing, the ↻ redo button must become active and restore the shape.
   */
  test('redo button restores the undone shape', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);
    const countAfterDraw = await countDrawnRects(page);

    // Redo must be disabled before any undo.
    await expect(page.locator('[title="Redo (⌘⇧Z)"]')).toBeDisabled();

    await jsClick(page, '[title="Undo (⌘Z)"]');
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(
      countAfterDraw - 1
    );

    await expect(page.locator('[title="Redo (⌘⇧Z)"]')).not.toBeDisabled();
    await jsClick(page, '[title="Redo (⌘⇧Z)"]');
    await expect.poll(() => countDrawnRects(page), { timeout: 3000 }).toBe(
      countAfterDraw
    );
  });
});
