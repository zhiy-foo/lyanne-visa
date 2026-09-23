import { test } from "@playwright/test";
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

for (const screen of screenList) {
  for (const state of screen.states) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        const suffix = state === "default" ? "" : `-${state}`;
        const fileName = `${screen.key}${suffix}-${viewport.width}-${theme}.png`;

        test(`${screen.key}${suffix} @ ${viewport.width}x${viewport.height} ${theme}`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize(viewport);
          await page.goto(`/dev/gallery/${screen.key}?state=${state}`);
          await page.waitForLoadState("networkidle");
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: join(OUT_DIR, fileName), fullPage: true });
        });
      }
    }
  }
}
