import { describe, expect, it } from "vitest";

import { contrastRatio, parseHex } from "./contrast";
import { createScaledTokens, scaleFactor } from "./scale";
import golden from "./tokens.golden.json";
import { THEME_ROLES, themes } from "./themes";
import {
  accessibilityFloors,
  borderWidths,
  canvasWidth,
  courtPalette,
  interactiveHeights,
  nightAlpha,
  palette,
  radii,
  sizes,
} from "./tokens.data";
import { strings } from "../strings/pt-BR";

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

const AA_TEXT = 4.5;
const AA_LARGE = 3;
const COURT_MIN = 7;

describe("tokens match the canvas golden", () => {
  it("brand colors", () => {
    for (const [name, entry] of Object.entries(golden.colors)) {
      expect(palette[name as keyof typeof palette]).toBe(entry.hex);
    }
  });
  it("court palettes, sizes, radii, borders, alphas", () => {
    expect(courtPalette).toEqual(golden.court);
    for (const [name, value] of Object.entries(golden.sizes)) {
      expect(sizes[name as keyof typeof sizes]).toBe(value);
    }
    for (const [name, value] of Object.entries(golden.radii)) {
      expect(radii[name as keyof typeof radii]).toBe(value);
    }
    expect(borderWidths).toEqual(golden.borderWidths);
    expect(nightAlpha).toEqual(golden.nightAlpha);
  });
});

describe("contrast function", () => {
  it("black on white is 21 and a color with itself is 1", () => {
    expect(ratio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(ratio(palette.sand, palette.sand)).toBe(1);
  });
  it("is symmetric", () => {
    expect(ratio(palette.night, palette.sand)).toBeCloseTo(ratio(palette.sand, palette.night), 10);
  });
  it("rejects invalid hex without throwing", () => {
    expect(parseHex("red").ok).toBe(false);
    expect(contrastRatio("#12", "#FFFFFF").ok).toBe(false);
  });
});

describe("AA contrast of the pairs components use", () => {
  it.each([
    [palette.night, palette.sand, AA_TEXT],
    [palette.night, palette.white, AA_TEXT],
    [palette.night, palette.serveOrange, AA_TEXT],
    [palette.textSecondary, palette.sand, AA_TEXT],
    [palette.textSecondary, palette.white, AA_TEXT],
    [palette.sand, palette.night, AA_TEXT],
    [palette.night, palette.waitingFill, AA_TEXT],
    [palette.netBlue, palette.sand, AA_LARGE],
  ])("%s on %s >= %s", (foreground, background, minimum) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});

describe("court themes reach 7:1", () => {
  it.each(["sun", "night"] as const)("%s", (name) => {
    const { background, foreground, muted } = courtPalette[name];
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(COURT_MIN);
    expect(ratio(muted, background)).toBeGreaterThanOrEqual(COURT_MIN);
  });
});

describe("themes", () => {
  it("all themes define every role", () => {
    for (const theme of Object.values(themes)) {
      expect(Object.keys(theme).sort()).toEqual([...THEME_ROLES].sort());
    }
  });
});

describe("accessibility floors", () => {
  it("interactive heights are at least the touch target", () => {
    for (const height of interactiveHeights) {
      expect(height).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
  });
});

describe("window scale", () => {
  const widths = [320, canvasWidth, 600];
  it("is 1 at the canvas width and grows with the window", () => {
    expect(scaleFactor(canvasWidth)).toBe(1);
    expect(scaleFactor(600)).toBeGreaterThan(scaleFactor(320));
  });
  it.each(widths)("keeps floors at width %s", (windowWidth) => {
    const tokens = createScaledTokens({ windowWidth, fontScale: 1 });
    for (const key of ["primaryButton", "iconButton", "field", "chip"] as const) {
      expect(tokens.sizes[key]).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
    expect(tokens.borderWidths.thin).toBeGreaterThanOrEqual(accessibilityFloors.hairline);
  });
  it("scales spacing and font and caps the system font scale", () => {
    const small = createScaledTokens({ windowWidth: 320, fontScale: 1 });
    const large = createScaledTokens({ windowWidth: 600, fontScale: 1 });
    expect(large.spacing.xl).toBeGreaterThan(small.spacing.xl);
    const capped = createScaledTokens({ windowWidth: canvasWidth, fontScale: 3 });
    const atCap = createScaledTokens({ windowWidth: canvasWidth, fontScale: 1.3 });
    expect(capped.fontSizes.body).toBe(atCap.fontSizes.body);
  });
});

describe("strings", () => {
  it("has no empty text", () => {
    const empty = JSON.stringify(strings).includes('""');
    expect(empty).toBe(false);
  });
});
