import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Returns stroke-dasharray value of the drawn shape rect, or null if absent. */
async function getShapeStrokeDash(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg rect')].find((r) => {
      const fill = r.getAttribute('fill');
      const { width, height } = r.getBoundingClientRect();
      return fill === 'transparent' && width > 20 && height > 20;
    });
    return el ? el.getAttribute('stroke-dasharray') : null;
  });
}

/** Returns the stroke attribute of the drawn shape rect. */
async function getShapeStrokeColor(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('svg rect')].find((r) => {
      const fill = r.getAttribute('fill');
      const { width, height } = r.getBoundingClientRect();
      return fill === 'transparent' && width > 20 && height > 20;
    });
    return el ? el.getAttribute('stroke') : null;
  });
}

async function drawAndSelectRect(page: Page) {
  await page.getByTitle('Rectangle').click();

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
  await page.mouse.click(cx - 80 + 2, cy);

  await expect
    .poll(() => getRectHandles(page), { timeout: 3000 })
    .toHaveLength(4);
}

// ─── Stroke dash style ────────────────────────────────────────────────────────

test.describe('stroke dash style', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /** Default stroke is solid — no stroke-dasharray attribute. */
  test('solid style has no stroke-dasharray', async ({ page }) => {
    await drawAndSelectRect(page);
    expect(await getShapeStrokeDash(page)).toBeNull();
  });

  /** Clicking the Dashed button sets a stroke-dasharray on the shape. */
  test('dashed button sets stroke-dasharray', async ({ page }) => {
    await drawAndSelectRect(page);

    await page.getByTitle('Dashed').click();

    await expect
      .poll(() => getShapeStrokeDash(page), { timeout: 3000 })
      .not.toBeNull();
  });

  /** Clicking the Dotted button sets a stroke-dasharray on the shape. */
  test('dotted button sets stroke-dasharray', async ({ page }) => {
    await drawAndSelectRect(page);

    await page.getByTitle('Dotted').click();

    await expect
      .poll(() => getShapeStrokeDash(page), { timeout: 3000 })
      .not.toBeNull();
  });

  /** Switching from dashed back to solid clears the stroke-dasharray. */
  test('switching back to solid removes stroke-dasharray', async ({ page }) => {
    await drawAndSelectRect(page);

    await page.getByTitle('Dashed').click();
    await expect
      .poll(() => getShapeStrokeDash(page), { timeout: 3000 })
      .not.toBeNull();

    await page.getByTitle('Solid').click();
    await expect
      .poll(() => getShapeStrokeDash(page), { timeout: 3000 })
      .toBeNull();
  });

  /** Stroke dash survives a YAML round-trip. */
  test('stroke dash round-trips through the YAML editor', async ({ page }) => {
    await drawAndSelectRect(page);
    await page.getByTitle('Dashed').click();

    // Open the YAML panel, read the content.
    await page.getByTitle('YAML').click();
    const editor = page.getByLabel('YAML drawing source');
    await expect(editor).toBeVisible();
    const yaml = await editor.inputValue();
    expect(yaml).toContain('strokeDash: dashed');
  });
});

// ─── Preset color swatches ────────────────────────────────────────────────────

test.describe('preset color swatches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Clicking a preset color swatch updates the shape's stroke color.
   * The initial default stroke is #1a1a1a; clicking the red preset (#e03131)
   * should change the SVG stroke attribute to #e03131.
   */
  test('clicking a preset swatch changes the stroke color', async ({
    page,
  }) => {
    await drawAndSelectRect(page);

    const initialColor = await getShapeStrokeColor(page);
    expect(initialColor).toBe('#1a1a1a');

    // Click the red preset swatch.
    await page.getByTitle('#e03131').click();

    await expect
      .poll(() => getShapeStrokeColor(page), { timeout: 3000 })
      .toBe('#e03131');
  });

  /** Clicking a second preset overwrites the first. */
  test('selecting a second preset overwrites the first', async ({ page }) => {
    await drawAndSelectRect(page);

    await page.getByTitle('#e03131').click();
    await expect
      .poll(() => getShapeStrokeColor(page), { timeout: 3000 })
      .toBe('#e03131');

    await page.getByTitle('#1971c2').click();
    await expect
      .poll(() => getShapeStrokeColor(page), { timeout: 3000 })
      .toBe('#1971c2');
  });
});
