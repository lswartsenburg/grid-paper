import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────
//
// Grid-coordinate helpers read SVG *attribute* values (which are in grid units
// because ShapeElement renders raw data-model coordinates inside a scaled <g>).
// This is different from getBoundingClientRect, which gives screen pixels.

/** Grid-space attributes of the drawn <circle> (hex stroke = drawn, not icon). */
async function getCircleGridAttrs(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg circle')].find((c) => {
      const s = c.getAttribute('stroke');
      return s && s.startsWith('#');
    });
    if (!el) return null;
    return {
      cx: parseFloat(el.getAttribute('cx') ?? '0'),
      cy: parseFloat(el.getAttribute('cy') ?? '0'),
      r: parseFloat(el.getAttribute('r') ?? '0'),
    };
  });
}

/** Grid-space attributes of the drawn <line> (hex stroke = drawn, not icon). */
async function getLineGridAttrs(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg line')].find((l) => {
      const s = l.getAttribute('stroke');
      return s && s.startsWith('#');
    });
    if (!el) return null;
    return {
      x1: parseFloat(el.getAttribute('x1') ?? '0'),
      y1: parseFloat(el.getAttribute('y1') ?? '0'),
      x2: parseFloat(el.getAttribute('x2') ?? '0'),
      y2: parseFloat(el.getAttribute('y2') ?? '0'),
    };
  });
}

/** Grid-space attributes of the drawn transparent <rect>. */
async function getRectGridAttrs(page: Page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg rect')].find(
      (r) => r.getAttribute('fill') === 'transparent'
    );
    if (!el) return null;
    return {
      x: parseFloat(el.getAttribute('x') ?? '0'),
      y: parseFloat(el.getAttribute('y') ?? '0'),
      width: parseFloat(el.getAttribute('width') ?? '0'),
      height: parseFloat(el.getAttribute('height') ?? '0'),
    };
  });
}

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
 * Returns true when the value is within 0.001 of an integer.
 * Tolerates any floating-point rounding that survives the snap + arithmetic.
 */
function isOnGrid(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 0.001;
}

// ─── Circle draw snap ─────────────────────────────────────────────────────────

test.describe('circle draw snap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * A diagonal drag produces a radius that is an irrational number in grid
   * units (sqrt of sum of squares). The snapRadius helper must round it to the
   * nearest integer before the shape is committed.
   *
   * 63 px × 42 px → Euclidean = √(63²+42²) ≈ 75.7 px = 3.786 grid units.
   * After snap: round(3.786) = 4.
   */
  test('diagonal drag produces an integer radius', async ({ page }) => {
    await page.getByTitle('Circle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 63, cy + 42, { steps: 10 });
    await page.mouse.up();

    const attrs = await getCircleGridAttrs(page);
    expect(attrs).not.toBeNull();
    expect(isOnGrid(attrs!.r)).toBe(true);
  });
});

// ─── Resize snap ──────────────────────────────────────────────────────────────

test.describe('resize snap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Resize a rect by a non-round pixel amount (73×47 px = 3.65×2.35 grid
   * units). After snap, all four SVG attributes must be integers.
   */
  test('rect resize lands on grid', async ({ page }) => {
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

    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    // 73 px = 3.65 grid units, 47 px = 2.35 grid units — neither is an integer
    await page.mouse.move(br.cx + 73, br.cy + 47, { steps: 10 });
    await page.mouse.up();

    const attrs = await getRectGridAttrs(page);
    expect(attrs).not.toBeNull();
    expect(isOnGrid(attrs!.x)).toBe(true);
    expect(isOnGrid(attrs!.y)).toBe(true);
    expect(isOnGrid(attrs!.width)).toBe(true);
    expect(isOnGrid(attrs!.height)).toBe(true);
  });

  /**
   * Resize a line's endpoint by a non-round pixel amount.
   * All four endpoint coordinates must be integers after snap.
   */
  test('line resize endpoint lands on grid', async ({ page }) => {
    await page.locator('[title="Line"]').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx - 100, cy - 60);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 60, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 73, br.cy + 47, { steps: 10 });
    await page.mouse.up();

    const attrs = await getLineGridAttrs(page);
    expect(attrs).not.toBeNull();
    expect(isOnGrid(attrs!.x1)).toBe(true);
    expect(isOnGrid(attrs!.y1)).toBe(true);
    expect(isOnGrid(attrs!.x2)).toBe(true);
    expect(isOnGrid(attrs!.y2)).toBe(true);
  });

  /**
   * Resize a circle by a non-round pixel amount.
   * The radius must snap to an integer; the center must not move.
   */
  test('circle resize radius lands on grid', async ({ page }) => {
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

    const before = await getCircleGridAttrs(page);
    expect(before).not.toBeNull();

    const handles = await getHandleCenters(page);
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    await page.mouse.move(br.cx, br.cy);
    await page.mouse.down();
    await page.mouse.move(br.cx + 73, br.cy + 47, { steps: 10 });
    await page.mouse.up();

    const after = await getCircleGridAttrs(page);
    expect(after).not.toBeNull();
    expect(isOnGrid(after!.r)).toBe(true);
    // Center must not move during a resize
    expect(after!.cx).toBeCloseTo(before!.cx, 3);
    expect(after!.cy).toBeCloseTo(before!.cy, 3);
  });
});
