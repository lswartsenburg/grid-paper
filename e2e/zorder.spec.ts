import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The snap step is 1 grid unit = 20 canvas pixels.
 * Returns the nearest snapped canvas-pixel position for a given raw pixel.
 */
function snapPx(canvasPx: number): number {
  const BASE_UNIT = 20;
  return Math.round(canvasPx / BASE_UNIT) * BASE_UNIT;
}

/**
 * Returns the viewport-pixel width of the last transparent rect in the canvas
 * SVG, which corresponds to the shape rendered on top (highest z-order).
 *
 * Shapes use fill="transparent"; selection handles use fill="white", so this
 * selector only matches drawn shapes.
 */
async function getTopRectWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rects = [
      ...document.querySelectorAll('svg rect[fill="transparent"]'),
    ];
    if (rects.length < 2) return 0;
    return rects[rects.length - 1].getBoundingClientRect().width;
  });
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
 * Activates the Select tool and waits for the toolbar button to visually
 * reflect the active state. This ensures React 18 has committed the tool
 * switch before any canvas interaction that depends on `tool.toolType === 'select'`.
 * (The context-menu and pointer-down handlers both check `tool.toolType`.)
 */
async function activateSelectTool(page: Page) {
  await page.getByTitle('Select').click();
  await expect(page.locator('[title="Select"]')).toHaveClass(/bg-zinc-900/);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('z-order context menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Scenario: rect A (large, ±100 px from center) drawn first, rect B (small,
   * ±20 px from center) drawn second → B initially on top.
   *
   * Strategy:
   *  - Shapes use fill="transparent": only edge proximity is hit-testable.
   *  - Compute exact snapped edge pixels so we click within the 8 px threshold.
   *  - Verify z-order via the DOM rendering order (last SVG rect = topmost), not
   *    by click-based selection — reliable regardless of fill.
   */
  test('Bring to front makes shape A the topmost rendered element', async ({
    page,
  }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = box!.width / 2;

    // Rect A: large, ±100 px. Left edge in canvas pixels after snap:
    const aLeftCanvasPx = snapPx(halfW - 100);

    // Viewport x position 2 px inside A's snapped left edge.
    const clickNearALeft = box!.x + aLeftCanvasPx + 2;

    // Draw A first (large), B second (small → initially on top).
    await drawRect(page, cx - 100, cy - 60, cx + 100, cy + 60);
    await drawRect(page, cx - 20, cy - 20, cx + 20, cy + 20);

    // Initially B (small) is topmost: last rect should have small width.
    const initialTopWidth = await getTopRectWidth(page);
    expect(initialTopWidth).toBeGreaterThan(0);
    expect(initialTopWidth).toBeLessThan(100); // B is narrow (~40 px)

    // Wait for React to commit the Select tool switch.
    await activateSelectTool(page);

    // Right-click 2 px inside A's left edge (well outside B) → context menu for A.
    // A's left edge is ≈ cx-100 from canvas left; B's left edge is ≈ cx-20 → 80 px apart.
    await page.mouse.click(clickNearALeft, cy, { button: 'right' });
    await expect(page.getByText('Bring to front')).toBeVisible();

    await page.getByText('Bring to front').click();
    await expect(page.getByText('Bring to front')).not.toBeVisible();

    // After bring-to-front: A (large) must be the last (topmost) rect in DOM.
    await expect
      .poll(() => getTopRectWidth(page), { timeout: 3000 })
      .toBeGreaterThan(100); // A is wide (~200 px)
  });

  /**
   * Scenario: same initial setup — B on top. Right-clicking B and choosing
   * "Send to back" should make A the topmost rendered element.
   */
  test('Send to back puts shape B behind shape A', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = box!.width / 2;

    // Rect B: small, ±20 px. Left edge in canvas pixels after snap:
    const bLeftCanvasPx = snapPx(halfW - 20);
    const clickNearBLeft = box!.x + bLeftCanvasPx + 2;

    // Draw A first (large), B second (small → on top).
    await drawRect(page, cx - 100, cy - 60, cx + 100, cy + 60);
    await drawRect(page, cx - 20, cy - 20, cx + 20, cy + 20);

    // Initially B (small) is topmost.
    const initialTopWidth = await getTopRectWidth(page);
    expect(initialTopWidth).toBeLessThan(100);

    // Wait for React to commit the Select tool switch.
    await activateSelectTool(page);

    // Right-click 2 px inside B's left edge → context menu for B.
    await page.mouse.click(clickNearBLeft, cy, { button: 'right' });
    await expect(page.getByText('Send to back')).toBeVisible();

    await page.getByText('Send to back').click();
    await expect(page.getByText('Send to back')).not.toBeVisible();

    // After send-to-back: A (large) must be the last (topmost) rect in DOM.
    await expect
      .poll(() => getTopRectWidth(page), { timeout: 3000 })
      .toBeGreaterThan(100);
  });

  /**
   * Scenario: A (large) drawn first, B (small) drawn second → B initially on
   * top. "Bring forward" on A should move A one step above B, making A topmost.
   * (With two shapes, one step == front, but this exercises the menu item.)
   */
  test('Bring forward moves shape A one step above shape B', async ({
    page,
  }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = box!.width / 2;

    // Rect A: large, ±100 px. Left edge is well outside B (±20 px).
    const aLeftCanvasPx = snapPx(halfW - 100);
    const clickNearALeft = box!.x + aLeftCanvasPx + 2;

    // Draw A first (large), B second (small → on top).
    await drawRect(page, cx - 100, cy - 60, cx + 100, cy + 60);
    await drawRect(page, cx - 20, cy - 20, cx + 20, cy + 20);

    // B (small) is initially topmost.
    const initialTopWidth = await getTopRectWidth(page);
    expect(initialTopWidth).toBeLessThan(100);

    await activateSelectTool(page);

    // Right-click 2 px inside A's left edge (outside B's range) → context menu for A.
    await page.mouse.click(clickNearALeft, cy, { button: 'right' });
    await expect(page.getByText('Bring forward')).toBeVisible();

    await page.getByText('Bring forward').click();
    await expect(page.getByText('Bring forward')).not.toBeVisible();

    // After bring-forward: A (large) is now the topmost rect in the DOM.
    await expect
      .poll(() => getTopRectWidth(page), { timeout: 3000 })
      .toBeGreaterThan(100);
  });

  /**
   * Scenario: same setup — B on top. "Send backward" on B should move it one
   * step behind A, making A the topmost rendered element.
   */
  test('Send backward moves shape B one step behind shape A', async ({
    page,
  }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const halfW = box!.width / 2;

    // Rect B: small, ±20 px. Left edge in canvas pixels after snap.
    const bLeftCanvasPx = snapPx(halfW - 20);
    const clickNearBLeft = box!.x + bLeftCanvasPx + 2;

    // Draw A first (large), B second (small → on top).
    await drawRect(page, cx - 100, cy - 60, cx + 100, cy + 60);
    await drawRect(page, cx - 20, cy - 20, cx + 20, cy + 20);

    // B (small) is initially topmost.
    const initialTopWidth = await getTopRectWidth(page);
    expect(initialTopWidth).toBeLessThan(100);

    await activateSelectTool(page);

    // Right-click 2 px inside B's left edge → context menu for B.
    await page.mouse.click(clickNearBLeft, cy, { button: 'right' });
    await expect(page.getByText('Send backward')).toBeVisible();

    await page.getByText('Send backward').click();
    await expect(page.getByText('Send backward')).not.toBeVisible();

    // After send-backward: A (large) is now the topmost rect in the DOM.
    await expect
      .poll(() => getTopRectWidth(page), { timeout: 3000 })
      .toBeGreaterThan(100);
  });
});
