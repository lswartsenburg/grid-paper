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

// ─── Space key in YAML editor ─────────────────────────────────────────────────

test.describe('YAML editor — space key', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Regression: the Space key used to be swallowed by the canvas pan handler
   * even when a textarea had focus, making it impossible to type labels or
   * shape names containing spaces in the YAML editor.
   *
   * This test opens the YAML sidebar, clicks into the editor, and types a
   * string with spaces. The content must reflect every character typed.
   */
  test('typing spaces in the YAML editor inserts them correctly', async ({
    page,
  }) => {
    await page.getByTitle('YAML').click();
    const editor = page.getByLabel('YAML drawing source');
    await expect(editor).toBeVisible();

    // Place the cursor at the end of the existing content.
    await editor.click();
    await editor.press('Control+End');

    // Type a comment line containing spaces — it must appear verbatim.
    await editor.type('# hello world test');

    const value = await editor.inputValue();
    expect(value).toContain('# hello world test');
  });

  /**
   * Typing a label with spaces in the YAML editor must apply to the canvas:
   * a shape with `label: "two words"` should render a text element with that
   * content, verifying that spaces are preserved through the parse pipeline.
   */
  test('YAML label with spaces renders on the canvas', async ({ page }) => {
    await page.getByTitle('YAML').click();
    const editor = page.getByLabel('YAML drawing source');
    await expect(editor).toBeVisible();

    // Replace the entire document with a rect that has a spaced label.
    await editor.fill(`layers:
  - name: "Layer 1"
    shapes:
      - label: "two words"
        type: rect
        origin: [2, 2]
        width: 6
        height: 4
`);

    // The YAML editor debounces 400 ms before parsing.
    await page.waitForTimeout(600);

    // The text element containing "two words" must appear on the SVG canvas.
    await expect(
      page.locator('text').filter({ hasText: 'two words' })
    ).toBeVisible();
  });
});

// ─── YAML editor — general interaction ───────────────────────────────────────

test.describe('YAML editor — round-trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Drawing a rectangle, then opening the YAML panel should show the shape
   * serialized with type: rect. This confirms the editor stays in sync with
   * canvas operations.
   */
  test('drawing a rect appears in the YAML editor', async ({ page }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.mouse.move(cx - 60, cy - 40);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 10 });
    await page.mouse.up();

    // Switch to select to deselect drawing tool, then open YAML.
    await page.getByTitle('Select').click();
    await page.getByTitle('YAML').click();

    const editor = page.getByLabel('YAML drawing source');
    await expect(editor).toBeVisible();

    await expect
      .poll(() => editor.inputValue(), { timeout: 3000 })
      .toContain('type: rect');
  });
});
