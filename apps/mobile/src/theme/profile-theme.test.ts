import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { accessibilityFloors, palette } from "./tokens.data";

const AA_TEXT = 4.5;
const SMALL = 320;
const MEDIUM = 390;
const LARGE = 600;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

describe("quick profile and account colors reach AA", () => {
  it.each([
    ["chosen level on orange", palette.night, palette.serveOrange],
    ["level caption on white", palette.textSecondary, palette.white],
    ["chosen chip on night", palette.sand, palette.night],
    ["row key and note on sand", palette.textSecondary, palette.sand],
    ["G of the login row on white", palette.netBlue, palette.white],
    ["Excluir conta title on its card", palette.dangerTitle, palette.dangerFill],
    ["note of the danger card", palette.textSecondary, palette.dangerFill],
    ["Excluir buttons in white on red", palette.white, palette.danger],
    ["blocker notice text on pale yellow", palette.night, palette.noticeFill],
  ])("%s", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("quick profile and account tokens scale and keep the touch floor", () => {
  it.each([SMALL, MEDIUM, LARGE])("at %i the chips, levels and rows stay >= 44", (width) => {
    const tokens = createScaledTokens({ windowWidth: width, fontScale: 1 });
    expect(tokens.sizes.chip).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.levelOption).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.settingRowMin).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.iconButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.loginBadge).toBeGreaterThan(0);
    // "Excluir" of the danger card (Conta.dc.html) and the buttons of 30a and 30b.
    expect(tokens.sizes.minTouchTarget).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    expect(tokens.sizes.primaryButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
  });

  it("the level option grows with the window", () => {
    const small = createScaledTokens({ windowWidth: SMALL, fontScale: 1 }).sizes.levelOption;
    const large = createScaledTokens({ windowWidth: LARGE, fontScale: 1 }).sizes.levelOption;
    expect(large).toBeGreaterThan(small);
  });
});
