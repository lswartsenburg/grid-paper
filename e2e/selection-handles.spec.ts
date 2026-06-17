import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Blue-stroke white-fill rect handles (used by rect and circle). */
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

/** Blue-stroke white-fill circle handles (used by line endpoints). */
async function getCircleHandles(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg circle')]
      .filter(
        (c) =>
          c.getAttribute('stroke') === 'rgb(59,130,246)' &&
          c.getAttribute('fill') === 'white'
      )
      .map((c) => {
        const { x, y, width, height } = c.getBoundingClientRect();
        return { cx: x + width / 2, cy: y + height / 2 };
      })
  );
}

// ─── Freehand selection handles ───────────────────────────────────────────────

test.describe('freehand selection handles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Selecting a freehand shape must show the dashed bounding box but NO
   * corner or endpoint handles — freehand shapes are not resizable via handles.
   */
  test('freehand selection shows no resize handles', async ({ page }) => {
    await page.getByTitle('Freehand').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Draw a freehand scribble.
    await page.mouse.move(cx - 60, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 8 });
    await page.mouse.move(cx + 60, cy, { steps: 8 });
    await page.mouse.up();

    // Select the freehand shape by clicking near its midpoint.
    await page.getByTitle('Select').click();
    await page.mouse.click(cx, cy - 20);

    // Wait briefly for any handles that might appear.
    await page.waitForTimeout(500);

    // No rect handles (used for rect/circle resize).
    expect(await getRectHandles(page)).toHaveLength(0);
    // No circle handles (used for line endpoints).
    expect(await getCircleHandles(page)).toHaveLength(0);
  });
});

// ─── Line endpoint handles ────────────────────────────────────────────────────

test.describe('line endpoint handles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Selecting a line must show exactly 2 circular endpoint handles placed at
   * the line's actual endpoints — not 4 bounding-box corner squares.
   */
  test('line selection shows 2 circle endpoint handles, not 4 rect corners', async ({
    page,
  }) => {
    await page.locator('[title="Line"]').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx - 80, cy - 50);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx, cy);

    // Exactly 2 endpoint circles must appear.
    await expect
      .poll(() => getCircleHandles(page), { timeout: 3000 })
      .toHaveLength(2);

    // No rect corner handles.
    expect(await getRectHandles(page)).toHaveLength(0);
  });

  /**
   * The two endpoint handles must be positioned near the actual line endpoints.
   * For a diagonal line drawn from (cx-80, cy-50) to (cx+80, cy+50), the
   * handle with the lower cx+cy sum must be close to the top-left endpoint.
   */
  test('endpoint handles are placed at the line endpoints', async ({
    page,
  }) => {
    await page.locator('[title="Line"]').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const dx = 80;
    const dy = 50;

    // Draw line from TL to BR.
    await page.mouse.move(cx - dx, cy - dy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
    await page.mouse.up();

    await page.getByTitle('Select').click();
    await page.mouse.click(cx, cy);

    await expect
      .poll(() => getCircleHandles(page), { timeout: 3000 })
      .toHaveLength(2);

    const handles = await getCircleHandles(page);
    const tl = handles.reduce((best, h) =>
      h.cx + h.cy < best.cx + best.cy ? h : best
    );
    const br = handles.reduce((best, h) =>
      h.cx + h.cy > best.cx + best.cy ? h : best
    );

    // TL handle must be near the top-left endpoint of the drawn line.
    expect(tl.cx).toBeCloseTo(cx - dx, -1);
    expect(tl.cy).toBeCloseTo(cy - dy, -1);

    // BR handle must be near the bottom-right endpoint.
    expect(br.cx).toBeCloseTo(cx + dx, -1);
    expect(br.cy).toBeCloseTo(cy + dy, -1);
  });
});
