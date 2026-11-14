import { describe, expect, it } from "vitest";

import { fakeFontLoader } from "../adapters/fake-font-loader";
import type { FontLoader } from "../services/font-loader";
import { contrastRatio, parseHex } from "./contrast";
import { createScaledTokens, scaleFactor, shortSide } from "./scale";
import { THEME_ROLES, themes } from "./themes";
import { accessibilityFloors, canvasWidth, fontScaleCap, scaleLimits } from "./tokens.data";

const AA_TEXT = 4.5;
const AA_LARGE = 3;
const INTERACTIVE = ["primaryButton", "iconButton", "field", "chip"] as const;
const EXTREME_WIDTHS = [1, 280, 320, canvasWidth, 1024, 100000];
const FONT_SCALES = [0.5, 1, 1.3, 2, 10];

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error(`invalid color ${first} ${second}`);
  return result.value;
}

describe("scale at extreme widths and font scales", () => {
  it.each(EXTREME_WIDTHS)("factor stays within limits at width %s", (width) => {
    const factor = scaleFactor(width);
    expect(factor).toBeGreaterThanOrEqual(scaleLimits.min);
    expect(factor).toBeLessThanOrEqual(scaleLimits.max);
  });

  it.each(EXTREME_WIDTHS.flatMap((w) => FONT_SCALES.map((f) => [w, f] as const)))(
    "floors hold at width %s and fontScale %s",
    (windowWidth, fontScale) => {
      const tokens = createScaledTokens({ windowWidth, fontScale });
      for (const key of INTERACTIVE) {
        expect(tokens.sizes[key]).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
      }
      for (const width of Object.values(tokens.borderWidths)) {
        expect(width).toBeGreaterThanOrEqual(accessibilityFloors.hairline);
      }
    },
  );

  it("fontScale 2.0 gives the same font as the cap, at any width", () => {
    for (const windowWidth of EXTREME_WIDTHS) {
      const high = createScaledTokens({ windowWidth, fontScale: 2 });
      const cap = createScaledTokens({ windowWidth, fontScale: fontScaleCap });
      expect(high.fontSizes).toEqual(cap.fontSizes);
      expect(high.spacing).toEqual(cap.spacing);
    }
  });

  it("fontScale below the cap still enlarges text, and never affects non-font tokens", () => {
    const one = createScaledTokens({ windowWidth: canvasWidth, fontScale: 1 });
    const mid = createScaledTokens({ windowWidth: canvasWidth, fontScale: 1.2 });
    expect(mid.fontSizes.body).toBeGreaterThan(one.fontSizes.body);
    expect(mid.sizes).toEqual(one.sizes);
  });

  it("is monotonic in width", () => {
    const factors = [1, 280, 320, 390, 500, 1024].map(scaleFactor);
    expect([...factors].sort((a, b) => a - b)).toEqual(factors);
  });

  it("narrow screen shrinks decorative sizes but keeps 44 floor", () => {
    const narrow = createScaledTokens({ windowWidth: 280, fontScale: 1 });
    const wide = createScaledTokens({ windowWidth: 1024, fontScale: 1 });
    expect(narrow.sizes.chip).toBe(accessibilityFloors.touchTarget);
    expect(wide.sizes.chip).toBeGreaterThanOrEqual(narrow.sizes.chip);
  });
});

describe("theme roles and contrast", () => {
  const names = Object.keys(themes) as (keyof typeof themes)[];

  it("every theme has exactly the same roles with non-empty values", () => {
    for (const name of names) {
      expect(Object.keys(themes[name]).sort()).toEqual([...THEME_ROLES].sort());
      for (const role of THEME_ROLES) expect(themes[name][role].length).toBeGreaterThan(0);
    }
  });

  it.each(["courtSun", "courtNight"] as const)("%s text pairs reach AA (7:1)", (name) => {
    const theme = themes[name];
    for (const fg of [theme.text, theme.textMuted, theme.link]) {
      expect(ratio(fg, theme.background)).toBeGreaterThanOrEqual(7);
      expect(ratio(fg, theme.surface)).toBeGreaterThanOrEqual(7);
    }
    expect(ratio(theme.onPrimary, theme.primary)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("app theme text pairs reach AA", () => {
    const t = themes.app;
    expect(ratio(t.text, t.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(t.text, t.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(t.textMuted, t.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(t.textMuted, t.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(ratio(t.link, t.background)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(ratio(t.link, t.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("court accent and primary are visible on the court background (non-text 3:1)", () => {
    for (const name of ["courtSun", "courtNight"] as const) {
      const theme = themes[name];
      expect(ratio(theme.primary, theme.background)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe("contrast function hardening", () => {
  it("accepts uppercase, lowercase and mixed case equally", () => {
    expect(ratio("#ff5a1f", "#0f1b2d")).toBeCloseTo(ratio("#FF5A1F", "#0F1B2D"), 10);
    expect(ratio("#Ff5A1f", "#0F1b2D")).toBeCloseTo(ratio("#FF5A1F", "#0F1B2D"), 10);
  });
  it.each([
    "#FFF",
    "FFFFFF",
    "#GGGGGG",
    "",
    " #FFFFFF",
    "#FFFFFF ",
    "#FFFFFFFF",
    "#12345",
    "rgb(0,0,0)",
  ])("rejects %j", (hex) => {
    expect(parseHex(hex).ok).toBe(false);
    expect(contrastRatio(hex, "#000000").ok).toBe(false);
    expect(contrastRatio("#000000", hex).ok).toBe(false);
  });
  it("parses channels correctly", () => {
    expect(parseHex("#0a10FF")).toEqual({ ok: true, value: [10, 16, 255] });
  });
  it("ratio is always within [1, 21]", () => {
    const samples = ["#000000", "#FFFFFF", "#FF5A1F", "#1F5BFF", "#808080"];
    for (const a of samples)
      for (const b of samples) {
        const value = ratio(a, b);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(21 + 1e-9);
      }
  });
});

describe("FontLoader fake swaps the real implementation", () => {
  it("fake satisfies the interface and reports loaded", () => {
    const loader: FontLoader = fakeFontLoader;
    expect(loader.useFontsLoaded()).toBe(true);
  });
  it("any other implementation can replace it through the interface", () => {
    const pending: FontLoader = { useFontsLoaded: () => false };
    const loaders: FontLoader[] = [fakeFontLoader, pending];
    expect(loaders.map((l) => l.useFontsLoaded())).toEqual([true, false]);
  });
});

describe("floors are pinned to literal WCAG values (not self-referential)", () => {
  it("touch target is 44 and hairline is 1", () => {
    expect(accessibilityFloors.touchTarget).toBe(44);
    expect(accessibilityFloors.hairline).toBe(1);
  });
  it("scaled interactive sizes never drop below literal 44 at width 280", () => {
    const tokens = createScaledTokens({ windowWidth: 280, fontScale: 2 });
    for (const key of INTERACTIVE) expect(tokens.sizes[key]).toBeGreaterThanOrEqual(44);
    expect(tokens.borderWidths.thin).toBeGreaterThanOrEqual(1);
  });
});

describe("scale by the shorter side of the window (landscape court)", () => {
  const PHONES = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ] as const;

  it.each(PHONES)("a $width x $height phone gives the same tokens upright and on its side", (p) => {
    const upright = createScaledTokens({
      windowWidth: shortSide(p.width, p.height),
      fontScale: 1,
    });
    const sideways = createScaledTokens({
      windowWidth: shortSide(p.height, p.width),
      fontScale: 1,
    });
    expect(sideways).toEqual(upright);
  });

  it("keeps the touch target and hairline floors on a 640 x 360 phone on its side", () => {
    const { court, borderWidths } = createScaledTokens({
      windowWidth: shortSide(640, 360),
      fontScale: 1,
    });
    expect(court.sizes.menuButton).toBeGreaterThanOrEqual(44);
    expect(court.sizes.undoButton).toBeGreaterThanOrEqual(44);
    expect(court.borderWidths.frame).toBeGreaterThanOrEqual(1);
    expect(borderWidths.thick).toBeGreaterThanOrEqual(1);
  });
});
