// SPDX-License-Identifier: AGPL-3.0-or-later
// The a11y gate — axe-core against the RUNNING game, live DOM and live CSS.
//
// ========================= WHY THIS GAME NEEDS IT MORE THAN ITS SIBLINGS =========================
// A visible grid of up to twenty-five real buttons is the LARGEST axe surface anything in this
// ecosystem has shipped. The chess consumer gets off lightly: its canvas is `aria-hidden` and its
// grid is `sr-only`, so almost nothing it draws is scannable at all. Here the board IS the DOM, so
// every colour ratio, every role, every label and every name is in scope — which is the price of the
// design and also the point of it.
//
// It therefore runs from the FIRST commits rather than at the end. A gate added late is a gate that
// finds a hundred findings at once and gets waived.
//
//   npm run build && npm run preview -- --port 4173 &
//   AXE_URL=http://localhost:4173/ npm run test:a11y
//
// The organisation's reusable workflow does exactly that when a game calls it with `a11y: true`.
//
// ⚠️ NO EXCLUSIONS, AND THAT IS DELIBERATE. The engine's own script excludes the third-party VLibras
// widget, which it must, because nobody here controls that markup. This game mounts no third-party
// widget, so an exclusion list would be an empty allowance sitting there waiting to be widened.

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.env.AXE_URL || 'http://localhost:4173/';

/**
 * Every board size is scanned, because they are not the same page: the number of cells, the digit
 * size and therefore the text contrast all change with it, and 5x5 is the tight one. Scanning only
 * the default would test the comfortable case and ship the other two.
 */
const SIZES = ['3', '4', '5'];

const browser = await chromium.launch();
let failures = 0;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  // A generous viewport first: this is about markup and contrast, not about layout under pressure —
  // the k=2 floor is measured by `tap-target` in the browser test project, where it can be asserted.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#sr-status', { timeout: 10_000 });

  // ⚠️ THE TITLE SCREEN IS SCANNED FIRST, AND IT IS THE ONE SURFACE THAT WOULD OTHERWISE BE MISSED.
  // It is the first thing anyone sees, it is a single full-screen control, and it is the only place
  // the pixel typeface appears — so its text contrast is a different measurement from the board's.
  // Scanning only what comes after the click would test everything except the front door.
  await page.waitForSelector('.screen--title button', { timeout: 10_000 });
  {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    if (results.violations.length) {
      failures += results.violations.length;
      console.error(`
✗ title screen`);
      console.error(JSON.stringify(results.violations, null, 2));
    } else {
      console.log('✓ title screen: 0 WCAG A/AA violations');
    }
  }

  // Into the game. Everything below needs the board and the panel, which live behind this click.
  await page.click('.screen--title button');
  await page.waitForSelector('[role="gridcell"]', { timeout: 10_000 });

  for (const size of SIZES) {
    await page.selectOption('#hud-size', size);
    await page.waitForFunction(
      (n) => document.querySelectorAll('[role="gridcell"]').length === Number(n) * Number(n),
      size,
      { timeout: 5_000 },
    );

    for (const contrast of [false, true]) {
      await page.setChecked('#hud-contrast', contrast);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      const where = `${size}x${size}, ${contrast ? 'high contrast' : 'normal'}`;
      if (results.violations.length) {
        failures += results.violations.length;
        console.error(`\n✗ ${where}`);
        console.error(JSON.stringify(results.violations, null, 2));
      } else {
        console.log(`✓ ${where}: 0 WCAG A/AA violations`);
      }
    }
  }
} finally {
  await browser.close();
}

if (failures) {
  console.error(`\n✗ axe: ${failures} WCAG A/AA violation(s).`);
  process.exit(1);
}
console.log('\n✓ axe: 0 WCAG A/AA violations: the title screen, and every board size in both palettes.');
