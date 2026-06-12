import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the bounding box of the drawn rect shape (fill="transparent",
 * not the canvas background or selection overlay).
 */
async function getShapeBox(page: Page) {
  return page.evaluate(() => {
    // Drawn shapes with transparent fill have fill="transparent".
    // Background rects have fill="white" or fill="url(...)" — excluded.
    // Corner handles have fill="white" — excluded.
    // Selection overlay rect has fill="rgba(...)" — excluded.
    const el = [...document.querySelectorAll('svg rect')].find((r) => {
      const fill = r.getAttribute('fill');
      const { width, height } = r.getBoundingClientRect();
      return fill === 'transparent' && width > 20 && height > 20;
    });
    if (!el) return null;
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });
}

/**
 * Returns the center coordinates of the SelectionOverlay corner handles.
 * Handles are identified by their distinctive blue stroke "rgb(59,130,246)",
 * which distinguishes them from toolbar icon SVG rects (stroke="currentColor")
 * and shape rects (stroke is a dark hex color).
 */
async function getHandleCenters(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg rect')]
      .filter((r) => r.getAttribute('stroke') === 'rgb(59,130,246)'
        && r.getAttribute('fill') === 'white')
      .map((r) => {
        const { x, y, width, height } = r.getBoundingClientRect();
        return { cx: x + width / 2, cy: y + height / 2 };
      })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('rectangle resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Draw a rect, select it, drag the BR corner outward, assert it grew.
   * Also verifies the top-left origin is unchanged (only BR moved).
   */
  test('dragging the BR corner enlarges the rect', async ({ page }) => {
    // ── 1. Draw a rectangle ──────────────────────────────────────────────────
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = 80;
    const halfH = 50;

    await page.mouse.move(cx - halfW, cy - halfH);
    await page.mouse.down();
    await page.mouse.move(cx + halfW, cy + halfH, { steps: 10 });
    await page.mouse.up();

    // ── 2. Select the rect by clicking its left edge ─────────────────────────
    // Default fill is transparent so only border clicks register as hits.
    // Click 2 px inside the left edge (well within the 8 px hit threshold).
    await page.getByTitle('Select').click();
    await page.mouse.click(cx - halfW + 2, cy);

    // ── 3. Wait for the 4 corner handles ────────────────────────────────────
    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    // ── 4. Snapshot bounds before resize ─────────────────────────────────────
    const before = await getShapeBox(page);
    expect(before).not.toBeNull();

    // ── 5. Drag the BR corner (highest cx+cy) outward ────────────────────────
    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 100, br.cy + 60, { steps: 10 });
    await page.mouse.up();

    // ── 6. Assert the shape is wider and taller ───────────────────────────────
    const after = await getShapeBox(page);
    expect(after).not.toBeNull();
    expect(after!.width).toBeGreaterThan(before!.width);
    expect(after!.height).toBeGreaterThan(before!.height);

    // Top-left origin should stay fixed when dragging BR.
    expect(after!.x).toBeCloseTo(before!.x, 0);
    expect(after!.y).toBeCloseTo(before!.y, 0);
  });

  /**
   * Confirms that the entire resize is a single history entry:
   * one Ctrl+Z should fully revert it.
   */
  test('resize is a single undo step', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = 80;
    const halfH = 50;

    await page.mouse.move(cx - halfW, cy - halfH);
    await page.mouse.down();
    await page.mouse.move(cx + halfW, cy + halfH, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx - halfW + 2, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const before = await getShapeBox(page);
    expect(before).not.toBeNull();

    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 100, br.cy + 60, { steps: 10 });
    await page.mouse.up();

    const after = await getShapeBox(page);
    expect(after!.width).toBeGreaterThan(before!.width);

    // CanvasEditor accepts ctrlKey OR metaKey — Control+z works on all platforms.
    await page.keyboard.press('Control+z');

    const afterUndo = await getShapeBox(page);
    expect(afterUndo).not.toBeNull();
    expect(afterUndo!.width).toBeCloseTo(before!.width, 0);
    expect(afterUndo!.height).toBeCloseTo(before!.height, 0);
  });

  /**
   * Dragging the TL corner inward should shrink the rect
   * and shift the origin, while the BR corner stays fixed.
   */
  test('dragging the TL corner inward shrinks the rect and moves origin', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = 80;
    const halfH = 50;

    await page.mouse.move(cx - halfW, cy - halfH);
    await page.mouse.down();
    await page.mouse.move(cx + halfW, cy + halfH, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx - halfW + 2, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const before = await getShapeBox(page);
    expect(before).not.toBeNull();

    // TL corner = lowest (cx + cy) sum
    const handles = await getHandleCenters(page);
    const tl = handles.reduce((best, h) =>
      h.cx + h.cy < best.cx + best.cy ? h : best
    );

    // Drag TL inward by 30×20 px
    await page.mouse.move(tl.cx, tl.cy);
    await page.mouse.down();
    await page.mouse.move(tl.cx + 30, tl.cy + 20, { steps: 10 });
    await page.mouse.up();

    const after = await getShapeBox(page);
    expect(after).not.toBeNull();

    // Shape is smaller
    expect(after!.width).toBeLessThan(before!.width);
    expect(after!.height).toBeLessThan(before!.height);

    // Origin moved right+down
    expect(after!.x).toBeGreaterThan(before!.x);
    expect(after!.y).toBeGreaterThan(before!.y);

    // BR corner is fixed (within 1 px rounding)
    expect(after!.x + after!.width).toBeCloseTo(before!.x + before!.width, 0);
    expect(after!.y + after!.height).toBeCloseTo(before!.y + before!.height, 0);
  });
});
