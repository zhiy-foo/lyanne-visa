import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { screenList } from "../src/app/dev/gallery/registry";

const OUT_DIR = join(__dirname, "..", "docs", "stayover", "reviews", "foundation-screens");
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const THEMES = ["light", "dark"] as const;

const MIN_TOUCH_TARGET = 44;

// Regression guard: every screenshot must (a) not cause horizontal overflow
// of the viewport, and (b) have every visible interactive control at least
// 44x44px tall/wide. Inline text links embedded in paragraph copy (e.g. the
// "leave it blank" link in Register's join-code error copy) are exempt —
// they read as part of a sentence, not as standalone tap targets, matching
// normal web text-link conventions.
async function assertNoLayoutRegressions(
  page: import("@playwright/test").Page,
  name: string,
) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `${name}: horizontal overflow — document.documentElement.scrollWidth (${overflow.scrollWidth}) exceeds window.innerWidth (${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth);

  const smallTargets = await page.evaluate((minSize) => {
    const elements = Array.from(
      document.querySelectorAll('button, a, input, select, [role="switch"]'),
    );
    return elements
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        // Skip inline text links nested inside a <p> — treated as copy, not a tap target.
        if (el.closest("p")) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return rect.height < minSize || rect.width < minSize;
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label =
          el.getAttribute("aria-label") ??
          el.textContent?.trim().slice(0, 40) ??
          "";
        return `${el.tagName.toLowerCase()} "${label}" (${Math.round(rect.width)}x${Math.round(rect.height)})`;
      });
  }, MIN_TOUCH_TARGET);

  expect(
    smallTargets,
    `${name}: interactive elements below the ${MIN_TOUCH_TARGET}px touch target: ${JSON.stringify(smallTargets)}`,
  ).toEqual([]);
}

for (const screen of screenList) {
  for (const state of screen.states) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const suffix = state === "default" ? "" : `-${state}`;
        const fileName = `${screen.key}${suffix}-${viewport.width}-${theme}.png`;
        const name = `${screen.key}${suffix} @ ${viewport.width}x${viewport.height} ${theme}`;

        test(name, async ({ page }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize(viewport);
          await page.goto(`/dev/gallery/${screen.key}?state=${state}`);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          await assertNoLayoutRegressions(page, name);
          await page.screenshot({ path: join(OUT_DIR, fileName), fullPage: true });
        });
      }
    }
  }
}
