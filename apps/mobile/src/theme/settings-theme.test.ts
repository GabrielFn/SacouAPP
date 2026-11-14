import { describe, expect, it } from "vitest";

import { contrastRatio, parseHex } from "./contrast";
import { createScaledTokens } from "./scale";
import { appTheme } from "./themes";
import {
  accessibilityFloors,
  canvasWidth,
  interactiveHeights,
  nightAlpha,
  palette,
  sizes,
} from "./tokens.data";

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
const HEX_RADIX = 16;
const WIDTHS = [320, canvasWidth, 600] as const;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

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

describe("contrast of the create-group and settings screens", () => {
  const segment = nightOver(palette.sand, nightAlpha.segment);
  it.each([
    ["muted text on the card", palette.textSecondary, palette.white],
    ["muted text on the sand", palette.textSecondary, palette.sand],
    ["muted text on the unselected segment track", palette.textSecondary, segment],
    ["text on the selected segment", palette.night, palette.white],
    ["text on the Pro tag", palette.night, palette.ballYellow],
    ["text on the error strip", palette.night, palette.waitingFill],
    ["selected chip", palette.sand, palette.night],
    ["selected template check", palette.night, palette.serveOrange],
  ])("%s reaches AA", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the off track of the switch reaches 3:1 against the card (WCAG 1.4.11)", () => {
    expect(
      ratio(nightOver(palette.white, nightAlpha.trackOff), palette.white),
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(appTheme.trackOff).toContain("rgba");
  });

  it("the on track keeps 3:1 against the card", () => {
    expect(ratio(palette.serveOrange, palette.white)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe("scale of the new controls", () => {
  it("all the touch targets are listed in the floors", () => {
    [
      sizes.switchTarget,
      sizes.segment,
      sizes.systemButton,
      sizes.templateOptionMin,
      sizes.courtOption,
      sizes.blockHeaderMin,
    ].forEach((target) => {
      expect(interactiveHeights).toContain(target);
    });
  });

  it.each(WIDTHS)("keeps the floors at width %s", (windowWidth) => {
    const tokens = createScaledTokens({ windowWidth, fontScale: 1 });
    [
      tokens.sizes.switchTarget,
      tokens.sizes.segment,
      tokens.sizes.systemButton,
      tokens.sizes.templateOptionMin,
      tokens.sizes.courtOption,
      tokens.sizes.blockHeaderMin,
      tokens.sizes.settingRowMin,
    ].forEach((target) => {
      expect(target).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    });
  });

  it("the switch grows with the window and its track fits in its target", () => {
    const small = createScaledTokens({ windowWidth: 320, fontScale: 1 });
    const large = createScaledTokens({ windowWidth: 600, fontScale: 1 });
    expect(large.sizes.switchTrackWidth).toBeGreaterThan(small.sizes.switchTrackWidth);
    [small, large].forEach(({ sizes: scaled }) => {
      expect(scaled.switchTargetWidth).toBeGreaterThanOrEqual(scaled.switchTrackWidth);
      expect(scaled.switchTarget).toBeGreaterThanOrEqual(scaled.switchTrackHeight);
    });
  });
});
