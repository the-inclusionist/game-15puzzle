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
// ⚠️ STILL NO EXCLUSION LIST — AND THE SENTENCE THAT USED TO BE HERE IS NOW FALSE, so it is replaced
// rather than left standing. It read: «This game mounts no third-party widget, so an exclusion list
// would be an empty allowance sitting there waiting to be widened.» This game now mounts one: the
// gov.br VLibras plugin, which is what gives the accessibility bar's Libras button something to
// translate with.
//
// The engine's own script answers that with an axe EXCLUSION. This one answers with a BLOCK instead,
// in the route below, and the difference is worth the two lines: an exclusion lets the widget's DOM
// into the page and then tells axe to look away — which is one selector away from being widened to
// cover our own markup on a bad afternoon. Blocking the script means the third-party DOM never
// arrives, so there is nothing to look away from, and every node axe sees is ours.
//
// What that costs, stated rather than hidden: the widget's own accessibility is never measured here.
// It never could be — nobody in this repository can fix it — but «not measured» is a different claim
// from «clean», and the gate should not be read as making the second one.

import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.env.AXE_URL || 'http://localhost:4173/';
/**
 * ⚠️ `?debug=true` IS ADDED HERE AND NOT ASKED OF THE CALLER. The scan needs the game's verification
 * surface to reach the high-contrast theme by name, and a caller who forgot the parameter would get a
 * run that scanned the normal palette twice and reported success — the worst kind of green.
 */
const URL = BASE + (BASE.includes('?') ? '&' : '?') + 'debug=true';

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
  // ⚠️ THE HEAVY DOWNLOAD IS BLOCKED HERE, IN THE TEST, AND NOT SWITCHED OFF IN THE PRODUCT.
  // This game asks the engine for the neural voices — ~190 MB of models, so a child who comes back on
  // day two without a network still has them. Three page loads per run, one per board size, would
  // fetch that three times and gate the pipeline on somebody else's CDN.
  //
  // Blocking it here rather than behind a test flag keeps the production path the one that ships: a
  // flag would make the behaviour a child actually gets the only behaviour nothing exercises.
  // `vlibras.gov.br` is here for the second reason, not the first: it is small, but it injects DOM
  // this repository does not own and cannot fix. See the note at the top of the file.
  //
  // ⚠️ AND `cdn.jsdelivr.net` IS NOW LOAD-BEARING FOR THAT BLOCK, WHICH IT WAS NOT WHEN IT WAS ADDED.
  // It went in as one of the heavy model CDNs. Measured on the built page: the gov.br plugin mirrors
  // ITSELF there — `cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@v7.12.2/app/vlibras-plugin.js`
  // plus its images — so blocking only `vlibras.gov.br` would let the widget in through the back door
  // and the exclusion-free claim above would quietly stop being true. Trimming this pattern because
  // "this game loads no models from jsdelivr" would be correct about the old reason and wrong now.
  await page.route(/huggingface\.co|hf\.co|cdn\.jsdelivr\.net|unpkg\.com|webgazer|vlibras\.gov\.br/, (r) => r.abort());

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
      // ⚠️ THE HIGH-CONTRAST THEME IS THE ENGINE'S NOW, so it is set where the engine keeps it rather
      // than through a checkbox this game no longer owns. Driving the bar's 🌗 icon here would make
      // the scan depend on how many times it has to be pressed to reach a given level, which is the
      // engine's business and would silently rot when the engine changes it.
      // No optional chaining: a missing surface must stop the run, not quietly scan the same palette
      // twice. This is the second half of the `?debug=true` note above.
      await page.evaluate((on) => {
        if (typeof window.__puzzle?.setTema !== 'function') {
          throw new Error('__puzzle.setTema is missing: the scan cannot reach the high-contrast theme');
        }
        window.__puzzle.setTema(on ? 'hc7' : 'padrao');
      }, contrast);
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
