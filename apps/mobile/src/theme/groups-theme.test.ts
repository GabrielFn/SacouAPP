import { describe, expect, it } from "vitest";

import { contrastRatio, parseHex } from "./contrast";
import { createScaledTokens } from "./scale";
import { appTheme } from "./themes";
import { accessibilityFloors, canvasWidth, nightAlpha, palette } from "./tokens.data";

const AA_TEXT = 4.5;
const HEX_RADIX = 16;
const WIDTHS = [320, canvasWidth, 600] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

/** The night color over a ground at the given opacity, as the hex the eye sees. */
function nightOver(ground: string, alpha: number): string {
  const night = parseHex(palette.night);
  const base = parseHex(ground);
  if (!night.ok || !base.ok) throw new Error("invalid test color");
  const mixed = night.value.map((value, index) =>
    Math.round(value * alpha + (base.value[index] ?? 0) * (1 - alpha))
      .toString(HEX_RADIX)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}

describe("contrast of the groups screens", () => {
  const badge = nightOver(palette.white, nightAlpha.badge);
  const badgeOnSand = nightOver(palette.sand, nightAlpha.badge);
  it.each([
    ["neutral role badge on the card", palette.textSecondary, badge],
    ["neutral role badge on the sand", palette.textSecondary, badgeOnSand],
    ["inactive tab on the sand", palette.textSecondary, palette.sand],
    ["active icon on the orange pill", palette.night, palette.serveOrange],
    ["admin badge", palette.sand, palette.night],
    ["offline strip", palette.night, palette.waitingFill],
    ["muted text on the card", palette.textSecondary, palette.white],
  ])("%s reaches AA", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it("gives the badge ground to every theme", () => {
    expect(appTheme.badgeSurface).toContain("rgba");
  });
});

describe("scale of the groups screens", () => {
  it.each(WIDTHS)("keeps the touch floors at width %s", (windowWidth) => {
    const { sizes, borderWidths } = createScaledTokens({ windowWidth, fontScale: 1 });
    for (const target of [sizes.tabItem, sizes.cardFooter, sizes.iconButton]) {
      expect(target).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
    expect(borderWidths.thin).toBeGreaterThanOrEqual(accessibilityFloors.hairline);
  });
  it("grows the card and the pill with the window", () => {
    const small = createScaledTokens({ windowWidth: 320, fontScale: 1 });
    const large = createScaledTokens({ windowWidth: 600, fontScale: 1 });
    expect(large.sizes.groupCardMin).toBeGreaterThan(small.sizes.groupCardMin);
    expect(large.sizes.tabPillWidth).toBeGreaterThan(small.sizes.tabPillWidth);
  });
});
