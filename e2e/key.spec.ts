import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Draws a rectangle and returns click coordinates for its left edge. */
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

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('shape key', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  /**
   * Setting a key via the Properties panel input saves it as a `data-key`
   * attribute on the SVG element, making it selectable in tests and YAML.
   */
  test('setting a key saves it to the SVG data-key attribute', async ({
    page,
  }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await drawRect(page, cx - 80, cy - 50, cx + 80, cy + 50);

    // Selecting a shape opens the Properties panel automatically.
    await page.getByTitle('Select').click();
    await page.mouse.click(cx - 80 + 2, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    // Type a key and commit with Enter.
    const keyInput = page.getByPlaceholder('none');
    await keyInput.fill('my-rect');
    await keyInput.press('Enter');

    // The SVG element for that shape must now expose data-key="my-rect".
    await expect(page.locator('[data-key="my-rect"]')).toBeVisible();
  });

  /**
   * Regression: pressing Backspace while the key input is focused used to
   * trigger the canvas-level delete handler and remove the selected shape.
   * The shape must survive Backspace keystrokes inside the key input field.
   */
  test('backspace inside the key input does not delete the shape', async ({
    page,
  }) => {
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
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    // Give the shape a key so there is text to delete in the input.
    const keyInput = page.getByPlaceholder('none');
    await keyInput.fill('delete-me');
    await keyInput.press('Enter');
    await expect(page.locator('[data-key="delete-me"]')).toBeVisible();

    // Focus the key input and press Backspace several times.
    await keyInput.click();
    await keyInput.press('Backspace');
    await keyInput.press('Backspace');
    await keyInput.press('Backspace');

    // The shape must still be on the canvas.
    await expect(page.locator('[data-key="delete-me"]')).toBeVisible();
    // Selection handles must still be present (shape was not deleted).
    expect(await getHandleCenters(page)).toHaveLength(4);
  });

  /**
   * Attempting to assign a key that is already used by another shape must:
   *  1. Show the inline error message.
   *  2. Leave the shape's key unchanged (no second data-key element appears).
   */
  test('duplicate key is rejected with an error and not saved', async ({
    page,
  }) => {
    await page.getByTitle('Rectangle').click();

    const canvas = page.locator('.touch-none').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Draw two non-overlapping rects side by side.
    await drawRect(page, cx - 160, cy - 40, cx - 40, cy + 40);
    await drawRect(page, cx + 40, cy - 40, cx + 160, cy + 40);

    await page.getByTitle('Select').click();

    // ── Select rect 1 and assign key "target" ────────────────────────────────
    await page.mouse.click(cx - 160 + 2, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    const keyInput = page.getByPlaceholder('none');
    await keyInput.fill('target');
    await keyInput.press('Enter');

    await expect(page.locator('[data-key="target"]')).toBeVisible();

    // ── Select rect 2, attempt the same key ──────────────────────────────────
    await page.mouse.click(cx + 40 + 2, cy);

    await expect
      .poll(() => getHandleCenters(page), { timeout: 3000 })
      .toHaveLength(4);

    // Wait for the Key input to reset to empty (useEffect fires on new selection).
    await expect(keyInput).toHaveValue('');

    await keyInput.fill('target');
    await keyInput.press('Enter');

    // ── Assert error is shown ─────────────────────────────────────────────────
    await expect(page.getByText('"target" is already used')).toBeVisible();

    // ── Assert the key was NOT saved on rect 2 ────────────────────────────────
    // There must still be exactly one element with this data-key.
    await expect(page.locator('[data-key="target"]')).toHaveCount(1);
  });
});
