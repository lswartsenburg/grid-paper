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

/**
 * Returns the rendered bounding box of the drawn SVG <line> element.
 * Toolbar icon lines use stroke="currentColor"; drawn lines have a hex
 * strokeColor, so filtering by that distinguishes them.
 */
async function getLineBounds(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg line')].find((l) => {
      const stroke = l.getAttribute('stroke');
      return stroke && stroke.startsWith('#');
    });
    if (!el) return null;
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });
}

/**
 * Returns the rendered bounding box of the drawn SVG <circle> element.
 * Toolbar icon circles use stroke="currentColor"; drawn circles have a hex
 * strokeColor (e.g. "#1a1a1a"), so filtering by that distinguishes them.
 */
async function getCircleBounds(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg circle')].find((c) => {
      const stroke = c.getAttribute('stroke');
      return stroke && stroke.startsWith('#');
    });
    if (!el) return null;
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });
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
  test('dragging the TL corner inward shrinks the rect and moves origin', async ({
    page,
  }) => {
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

// ─── Line resize ──────────────────────────────────────────────────────────────

test.describe('line resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Draw a diagonal line, select it, drag one endpoint outward via a corner
   * handle, and confirm the rendered line bounding box grew.
   */
  test('dragging a corner handle moves the nearer endpoint', async ({
    page,
  }) => {
    // ── 1. Draw a diagonal line ──────────────────────────────────────────────
    await page.locator('[title="Line"]').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = 100;
    const halfH = 60;

    await page.mouse.move(cx - halfW, cy - halfH);
    await page.mouse.down();
    await page.mouse.move(cx + halfW, cy + halfH, { steps: 10 });
    await page.mouse.up();

    // ── 2. Select the line ───────────────────────────────────────────────────
    await page.getByTitle('Select').click();
    // Click near the middle of the line (on the stroke)
    await page.mouse.click(cx, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const before = await getLineBounds(page);
    expect(before).not.toBeNull();

    // ── 3. Drag the BR corner (highest cx+cy) outward ────────────────────────
    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 80, br.cy + 50, { steps: 10 });
    await page.mouse.up();

    // ── 4. Line bounding box must be larger ──────────────────────────────────
    const after = await getLineBounds(page);
    expect(after).not.toBeNull();
    expect(after!.width + after!.height).toBeGreaterThan(
      before!.width + before!.height
    );
  });

  /** The whole resize is one undo step. */
  test('line resize is a single undo step', async ({ page }) => {
    await page.locator('[title="Line"]').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = 100;
    const halfH = 60;

    await page.mouse.move(cx - halfW, cy - halfH);
    await page.mouse.down();
    await page.mouse.move(cx + halfW, cy + halfH, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const before = await getLineBounds(page);
    expect(before).not.toBeNull();

    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 80, br.cy + 50, { steps: 10 });
    await page.mouse.up();

    const after = await getLineBounds(page);
    expect(after!.width + after!.height).toBeGreaterThan(
      before!.width + before!.height
    );

    await page.keyboard.press('Control+z');

    const afterUndo = await getLineBounds(page);
    expect(afterUndo).not.toBeNull();
    expect(afterUndo!.width).toBeCloseTo(before!.width, 0);
    expect(afterUndo!.height).toBeCloseTo(before!.height, 0);
  });
});

// ─── Circle resize ────────────────────────────────────────────────────────────

test.describe('circle resize', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Draw a circle, select it, drag the BR corner outward, and confirm
   * the rendered circle bounding box grew while the center stayed fixed.
   */
  test('dragging a corner handle enlarges the circle', async ({ page }) => {
    // ── 1. Draw a circle ─────────────────────────────────────────────────────
    await page.getByTitle('Circle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Draw by dragging from center outward (circle tool uses center+edge)
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy, { steps: 10 });
    await page.mouse.up();

    // ── 2. Select the circle ─────────────────────────────────────────────────
    await page.getByTitle('Select').click();
    // Click on the top edge of the circle (on the stroke)
    await page.mouse.click(cx, cy - 78);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const before = await getCircleBounds(page);
    expect(before).not.toBeNull();

    const beforeCenterX = before!.x + before!.width / 2;
    const beforeCenterY = before!.y + before!.height / 2;

    // ── 3. Drag the BR corner outward ────────────────────────────────────────
    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 60, br.cy + 60, { steps: 10 });
    await page.mouse.up();

    // ── 4. Circle is larger; center stayed fixed ──────────────────────────────
    const after = await getCircleBounds(page);
    expect(after).not.toBeNull();
    expect(after!.width).toBeGreaterThan(before!.width);
    expect(after!.height).toBeGreaterThan(before!.height);

    const afterCenterX = after!.x + after!.width / 2;
    const afterCenterY = after!.y + after!.height / 2;
    expect(afterCenterX).toBeCloseTo(beforeCenterX, 0);
    expect(afterCenterY).toBeCloseTo(beforeCenterY, 0);
  });

  /** The whole resize is one undo step. */
  test('circle resize is a single undo step', async ({ page }) => {
    await page.getByTitle('Circle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx, cy - 78);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const before = await getCircleBounds(page);
    expect(before).not.toBeNull();

    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 60, br.cy + 60, { steps: 10 });
    await page.mouse.up();

    const after = await getCircleBounds(page);
    expect(after!.width).toBeGreaterThan(before!.width);

    await page.keyboard.press('Control+z');

    const afterUndo = await getCircleBounds(page);
    expect(afterUndo).not.toBeNull();
    expect(afterUndo!.width).toBeCloseTo(before!.width, 0);
  });
});
