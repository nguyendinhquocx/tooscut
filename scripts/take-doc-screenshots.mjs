#!/usr/bin/env node
/**
 * Capture documentation screenshots using Playwright.
 *
 * Prerequisites:
 *   pnpm add -Dw playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   pnpm --filter @tooscut/ui dev   # start dev server first
 *   node scripts/take-doc-screenshots.mjs [--base-url http://localhost:4200]
 *
 * Output: apps/docs/content/docs/_images/
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = resolve(__dirname, "../apps/docs/content/docs/_images");
const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:4200";

mkdirSync(IMAGES_DIR, { recursive: true });

// Timeline layout constants (must match apps/ui/src/components/timeline/constants.ts)
const TRACK_HEADER_WIDTH = 150;
const RULER_HEIGHT = 40;
const DEFAULT_TRACK_HEIGHT = 60;

// ───────────────────────── Helpers ─────────────────────────────────────────

async function shot(page, locator, name) {
  const el = typeof locator === "string" ? page.locator(locator).first() : locator;
  try {
    await el.waitFor({ state: "visible", timeout: 5_000 });
    await el.screenshot({ path: resolve(IMAGES_DIR, name) });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.log(`  ✗ ${name} — ${e.message.split("\n")[0]}`);
  }
}

async function fullshot(page, name) {
  await page.screenshot({ path: resolve(IMAGES_DIR, name) });
  console.log(`  ✓ ${name} (full)`);
}

async function waitForEditor(page) {
  await page.locator('button:has-text("File")').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function clickAssetTab(page, name) {
  await page.locator(`div.flex.border-b button:has-text("${name}")`).first().click();
  await page.waitForTimeout(300);
}

async function clickPropsTab(page, name) {
  const tab = page.locator(`[data-slot="tabs-tab"]:has-text("${name}")`).last();
  const visible = await tab.isVisible().catch(() => false);
  if (!visible) {
    console.log(`    ⓘ "${name}" tab not visible, skipping`);
    return false;
  }
  await tab.click();
  await page.waitForTimeout(300);
  return true;
}

function propsPanel(page) {
  return page.locator("div.h-full.overflow-auto.bg-card").last();
}

/** Drag an element to a position on the timeline canvas. */
async function dragToTimeline(page, sourceLocator, targetX, targetY) {
  const src = typeof sourceLocator === "string" ? page.locator(sourceLocator).first() : sourceLocator;
  const konva = page.locator(".konvajs-content").first();

  await src.waitFor({ state: "visible", timeout: 5_000 });
  const srcBox = await src.boundingBox();
  const konvaBox = await konva.boundingBox();
  if (!srcBox || !konvaBox) return;

  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(konvaBox.x + targetX, konvaBox.y + targetY, { steps: 15 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(600);
}

/** Click a position on the timeline canvas (Konva). */
async function clickTimeline(page, x, y) {
  const konva = page.locator(".konvajs-content").first();
  const box = await konva.boundingBox();
  if (!box) return;
  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(400);
}

/** Get the Y center for a video track in the timeline. trackIdx 0 = V1 (bottom). */
function videoTrackY(konvaHeight, trackIdx) {
  const sectionHeight = Math.floor((konvaHeight - RULER_HEIGHT) / 2);
  return RULER_HEIGHT + sectionHeight - (trackIdx + 1) * DEFAULT_TRACK_HEIGHT + DEFAULT_TRACK_HEIGHT / 2;
}

// ───────────────────────── Main ───────────────────────────────────────────

async function main() {
  console.log(`Screenshots → ${IMAGES_DIR}`);
  console.log(`Editor: ${BASE_URL}\n`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--use-angle=metal",
      "--enable-features=Vulkan,UseSkiaRenderer",
      "--enable-unsafe-webgpu",
      "--enable-webgpu-developer-features",
      "--disable-dawn-features=disallow_unsafe_apis",
      "--window-position=-2400,-2400",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();

  // ── Create a project ────────────────────────────────────────────────
  console.log("Creating project…");
  await page.goto(`${BASE_URL}/projects`);
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("New Project"), a:has-text("New Project")').first().click();
  await page.waitForTimeout(2000);
  await waitForEditor(page);
  console.log("Editor ready.\n");

  // ── Project Settings Dialog ─────────────────────────────────────────
  console.log("[basics/project-settings]");
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.isVisible().catch(() => false)) {
    await shot(page, dialog, "project-settings-dialog.png");
    await dialog.locator('button:has-text("Save")').click();
    await page.waitForTimeout(500);
  }

  // ── Blank editor ────────────────────────────────────────────────────
  console.log("[getting-started]");
  await fullshot(page, "tooscut-blank.png");

  // ── Keyboard Shortcuts Modal ────────────────────────────────────────
  console.log("[advanced/keyboard-shortcuts]");
  await page.keyboard.press("?");
  await page.waitForTimeout(500);
  await shot(page, '[role="dialog"]', "keyboard-shortcuts-modal.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ── Export Dialog ───────────────────────────────────────────────────
  console.log("[basics/exporting]");
  await page.keyboard.press("Meta+e");
  await page.waitForTimeout(500);
  await shot(page, '[role="dialog"]', "export-dialog.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ── Shape panel ─────────────────────────────────────────────────────
  console.log("[media/adding-shapes]");
  await clickAssetTab(page, "Shapes");
  await shot(page, "div.relative.flex.h-full.flex-col >> nth=0", "shape-panel.png");

  // ── Transition panel ────────────────────────────────────────────────
  console.log("[animation/transitions]");
  await clickAssetTab(page, "Transitions");
  await shot(page, "div.relative.flex.h-full.flex-col >> nth=0", "transition-panel.png");

  // ── Playback controls ──────────────────────────────────────────────
  console.log("[basics/playback-and-navigation]");
  const playBtn = page.locator('button[class*="rounded-full"][class*="size-"]').first();
  await shot(page, playBtn.locator("../.."), "playback-controls.png");

  // ══════════════════════════════════════════════════════════════════════
  // Populate timeline by dragging templates from the asset panel
  // ══════════════════════════════════════════════════════════════════════
  console.log("\nDragging clips onto timeline…");

  const konva = page.locator(".konvajs-content").first();
  const konvaBox = await konva.boundingBox();
  const v1Y = videoTrackY(konvaBox.height, 0);

  // Drag Rectangle onto V1 at the start
  await clickAssetTab(page, "Shapes");
  await page.waitForTimeout(300);

  const rectCard = page.locator('div[draggable="true"]:has-text("Rectangle")').first();
  await dragToTimeline(page, rectCard, TRACK_HEADER_WIDTH + 80, v1Y);
  console.log("  ✓ Rectangle → V1");

  // Drag Arrow onto V1, offset to the right
  const arrowCard = page.locator('div[draggable="true"]:has-text("Arrow")').first();
  await dragToTimeline(page, arrowCard, TRACK_HEADER_WIDTH + 400, v1Y);
  console.log("  ✓ Arrow → V1");

  // Drag Text onto V1, further right
  await clickAssetTab(page, "Text");
  await page.waitForTimeout(300);
  const textCard = page.locator('div[draggable="true"]').first();
  await dragToTimeline(page, textCard, TRACK_HEADER_WIDTH + 700, v1Y);
  console.log("  ✓ Text → V1");

  // Back to Assets
  await clickAssetTab(page, "Assets");
  await page.waitForTimeout(500);

  // ── Timeline with clips ─────────────────────────────────────────────
  console.log("\n[basics/timeline-overview]");
  const timeline = page.locator(".konvajs-content").first().locator("..");
  await shot(page, timeline, "timeline-overview.png");
  await shot(page, timeline, "multi-track-editing.png");

  // ══════════════════════════════════════════════════════════════════════
  // Select clips by clicking on them in the timeline → capture properties
  // ══════════════════════════════════════════════════════════════════════

  // Click on the rectangle clip (first clip, near the start of V1)
  console.log("\n[media/adding-shapes] Select rectangle");
  await clickTimeline(page, TRACK_HEADER_WIDTH + 80, v1Y);

  let tabCount = await page.locator('[data-slot="tabs-tab"]').count();
  if (tabCount > 0) {
    if (await clickPropsTab(page, "Shape"))
      await shot(page, propsPanel(page), "shape-properties.png");

    console.log("[effects/video-effects]");
    if (await clickPropsTab(page, "Effect"))
      await shot(page, propsPanel(page), "video-effects-panel.png");

    console.log("[animation/transitions] Transition properties");
    if (await clickPropsTab(page, "Transition"))
      await shot(page, propsPanel(page), "transition-properties.png");
  } else {
    console.log("  ⓘ No tabs after clicking rectangle");
  }

  // Full editor with shape selected
  await fullshot(page, "shape-on-canvas.png");

  // ── Keyframe buttons ────────────────────────────────────────────────
  // Animate the stroke Width on the rectangle with two different values:
  // 1. Move playhead to clip start, set Width to 2, click its keyframe diamond
  // 2. Move playhead to ~3s, set Width to 20 (auto-adds second keyframe)
  // 3. Move playhead between them for half-filled diamond screenshot
  // 4. Open curve editor to show the actual curve
  console.log("\n[animation/keyframing] Keyframe buttons");

  // Helper to set a NumericInput value by label
  async function setNumericInPanel(panel, labelText, value) {
    const row = panel.locator(`span.text-xs:has-text("${labelText}")`).first().locator("..");
    const numInput = row.locator('div[class*="cursor-ew-resize"]').first();
    if (!(await numInput.isVisible().catch(() => false))) return false;
    await numInput.dblclick();
    await page.waitForTimeout(200);
    const input = row.locator("input").first();
    await input.fill(String(value));
    await input.press("Enter");
    await page.waitForTimeout(300);
    return true;
  }

  // Helper to click the keyframe diamond next to a specific property label
  async function clickKeyframeDiamond(panel, labelText) {
    const row = panel.locator(`span.text-xs:has-text("${labelText}")`).first().locator("..");
    const diamond = row.locator('button[title="Add keyframe"], button[title="Remove keyframe"]').first();
    if (!(await diamond.isVisible().catch(() => false))) return false;
    await diamond.click();
    await page.waitForTimeout(300);
    return true;
  }

  // Select rectangle and go to Shape tab
  await clickTimeline(page, TRACK_HEADER_WIDTH + 20, v1Y);
  await page.waitForTimeout(300);

  if (await clickPropsTab(page, "Shape")) {
    const panel = propsPanel(page);

    // Step 1: Move playhead to clip start, set Width=2, add keyframe
    await clickTimeline(page, TRACK_HEADER_WIDTH + 20, RULER_HEIGHT / 2);
    await page.waitForTimeout(200);
    await clickTimeline(page, TRACK_HEADER_WIDTH + 20, v1Y); // re-select
    await page.waitForTimeout(300);

    await setNumericInPanel(panel, "Width", 2);
    await clickKeyframeDiamond(panel, "Width");

    // Step 2: Move playhead to ~3s, set Width=20 (auto-adds second keyframe)
    await clickTimeline(page, TRACK_HEADER_WIDTH + 170, RULER_HEIGHT / 2);
    await page.waitForTimeout(200);
    await clickTimeline(page, TRACK_HEADER_WIDTH + 80, v1Y); // re-select
    await page.waitForTimeout(300);

    await setNumericInPanel(panel, "Width", 20);

    // Step 3: Move playhead between keyframes for half-filled state
    await clickTimeline(page, TRACK_HEADER_WIDTH + 100, RULER_HEIGHT / 2);
    await page.waitForTimeout(200);
    await clickTimeline(page, TRACK_HEADER_WIDTH + 80, v1Y); // re-select
    await page.waitForTimeout(300);

    await shot(page, panel, "keyframe-buttons-active.png");

    // Step 4: Open curve editor
    console.log("[animation/keyframing] Curve editor");
    const curvesBtn = page.locator('button:has-text("Curves")').first();
    if (await curvesBtn.isVisible().catch(() => false)) {
      await curvesBtn.click();
      await page.waitForTimeout(500);

      const timelinePanel = page.locator("div.flex.h-full.w-full.overflow-hidden").last();
      await shot(page, timelinePanel, "keyframe-curve-editor.png");

      await curvesBtn.click();
      await page.waitForTimeout(300);
    } else {
      console.log("  ⓘ Curves button not visible");
    }
  }

  // Click on the arrow/line clip — move playhead to 10s so the arrow is visible in preview
  console.log("\n[media/adding-lines-and-arrows] Select arrow");
  // Move playhead to ~10s (30fps × 10s = 300 frames, × 1.67 zoom ≈ 500px)
  await clickTimeline(page, TRACK_HEADER_WIDTH + 500, RULER_HEIGHT / 2);
  await page.waitForTimeout(300);
  await clickTimeline(page, TRACK_HEADER_WIDTH + 400, v1Y);
  tabCount = await page.locator('[data-slot="tabs-tab"]').count();
  if (tabCount > 0) {
    if (await clickPropsTab(page, "Line")) {
      // Change stroke width to 10 and end head size to 35 for a better screenshot
      const panel = propsPanel(page);

      // Helper: double-click a NumericInput to enter edit mode, type value, press Enter
      async function setNumericValue(labelText, value) {
        // PropertyRow: <div> <span>Label</span> ... <div class="cursor-ew-resize"> (NumericInput) </div> </div>
        const row = panel.locator(`span.text-xs:has-text("${labelText}")`).locator("..");
        const numInput = row.locator('div[class*="cursor-ew-resize"]').first();
        if (!(await numInput.isVisible().catch(() => false))) return;
        await numInput.dblclick();
        await page.waitForTimeout(200);
        // Now the input should be visible
        const input = row.locator("input").first();
        await input.fill(String(value));
        await input.press("Enter");
        await page.waitForTimeout(300);
      }

      await setNumericValue("Width", 10);
      await setNumericValue("Head Size", 35);

      await shot(page, panel, "line-properties.png");
    }
  }
  await fullshot(page, "line-on-canvas.png");

  // Click on the text clip — first move playhead to 15s so the text is visible in preview
  console.log("\n[media/adding-text] Select text");
  // Move playhead to ~15s by clicking the ruler (30fps × 15s = 450 frames, × 1.67 zoom ≈ 750px)
  const rulerClickX = TRACK_HEADER_WIDTH + 750;
  await clickTimeline(page, rulerClickX, RULER_HEIGHT / 2);
  await page.waitForTimeout(300);
  // Now click the text clip on the timeline
  await clickTimeline(page, TRACK_HEADER_WIDTH + 700, v1Y);
  tabCount = await page.locator('[data-slot="tabs-tab"]').count();
  if (tabCount > 0) {
    if (await clickPropsTab(page, "Text"))
      await shot(page, propsPanel(page), "text-properties.png");
  }
  await fullshot(page, "text-on-canvas.png");

  // ── Split before/after ──────────────────────────────────────────────
  console.log("\n[basics/splitting-and-trimming]");
  // Click the ruler to move playhead to the middle of the rectangle clip
  const rulerY = RULER_HEIGHT / 2;
  await clickTimeline(page, TRACK_HEADER_WIDTH + 80, rulerY);
  await page.waitForTimeout(200);

  // Select the rectangle clip
  await clickTimeline(page, TRACK_HEADER_WIDTH + 80, v1Y);
  await page.waitForTimeout(200);
  await shot(page, timeline, "split-before.png");

  // Split with S
  await page.keyboard.press("s");
  await page.waitForTimeout(500);
  await shot(page, timeline, "split-after.png");

  // ══════════════════════════════════════════════════════════════════════
  console.log("\n✅ Done.\n");

  const fs = await import("fs");
  const files = fs.readdirSync(IMAGES_DIR).filter((f) => f.endsWith(".png"));
  console.log(`Captured ${files.length} screenshots:`);
  files.forEach((f) => console.log(`  • ${f}`));

  console.log("\nScreenshots that still need manual capture:");
  console.log("  • Asset panel with real imported video files");
  console.log("  • Drag-and-drop GIFs");
  console.log("  • Font picker dropdown open");
  console.log("  • Audio effects panel (needs imported video with audio)");
  console.log("  • Color grading panels (needs video/image clip)");
  console.log("  • Keyframe curve editor, easing presets, Bezier editor");
  console.log("  • Export progress mid-render");
  console.log("  • Trim handle cursor");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
