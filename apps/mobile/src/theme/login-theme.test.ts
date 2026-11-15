import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { accessibilityFloors, palette, sandAlpha } from "./tokens.data";

const AA_TEXT = 4.5;
const SMALL = 320;
const MEDIUM = 390;
const LARGE = 600;
const HEX_BASE = 16;
const HEX_PAIR = 2;
const CHANNEL_MAX = 255;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

/** The translucent sand over the night, as the screen shows it. */
function blend(foreground: string, background: string, alpha: number): string {
  const channels = (hex: string) =>
    [1, 1 + HEX_PAIR, 1 + HEX_PAIR * 2].map((at) =>
      Number.parseInt(hex.slice(at, at + HEX_PAIR), HEX_BASE),
    );
  const top = channels(foreground);
  const bottom = channels(background);
  const mixed = top.map((value, index) =>
    Math.min(CHANNEL_MAX, Math.round(value * alpha + (bottom[index] ?? 0) * (1 - alpha))),
  );
  return `#${mixed.map((value) => value.toString(HEX_BASE).padStart(HEX_PAIR, "0")).join("")}`;
}

describe("login colors reach AA", () => {
  it.each([
    ["Google label on orange", palette.night, palette.serveOrange],
    ["sheet text on sand", palette.night, palette.sand],
    ["help and legal on sand", palette.textSecondary, palette.sand],
    ["brand and title on night", palette.sand, palette.night],
    ["G on its white badge", palette.netBlue, palette.white],
    ["hero line on night", blend(palette.sand, palette.night, sandAlpha.heroMuted), palette.night],
  ])("%s", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("login tokens scale and keep the touch floor", () => {
  it.each([SMALL, MEDIUM, LARGE])("at %i the 56 buttons and the 48 link stay >= 44", (width) => {
    const tokens = createScaledTokens({ windowWidth: width, fontScale: 1 });
    expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.linkButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.radii.sheet).toBeGreaterThan(0);
    expect(tokens.fontSizes.legal).toBeGreaterThan(0);
  });
});
