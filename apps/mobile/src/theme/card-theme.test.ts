import { describe, expect, test } from "vitest";

import { CARD_COMPACT_RATIO, cardAvatarColor, cardMeasures } from "./card-tokens.data";
import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { palette } from "./tokens.data";

const AA_TEXT = 4.5;
const WIDTHS = [320, 390, 430] as const;
/** Rounding of each measure to whole pixels may differ by this much from the exact ratio. */
const ROUNDING = 1;
const LABEL_OPACITY = 0.82;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  if (!result.ok) throw new Error("invalid test color");
  return result.value;
}

function mix(foreground: string, background: string, opacity: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  const part = (at: number) =>
    Math.round(channel(foreground, at) * opacity + channel(background, at) * (1 - opacity));
  const hex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${hex(part(1))}${hex(part(3))}${hex(part(5))}`;
}

describe("the player card tokens", () => {
  test.each(WIDTHS)("at %i the compact card is the full one times the ratio", (width) => {
    const { full, compact } = createScaledTokens({ windowWidth: width, fontScale: 1 }).card;
    for (const key of Object.keys(cardMeasures) as (keyof typeof cardMeasures)[]) {
      expect(Math.abs(compact[key] - full[key] * CARD_COMPACT_RATIO)).toBeLessThanOrEqual(ROUNDING);
    }
  });

  test("the card grows with the window", () => {
    const small = createScaledTokens({ windowWidth: WIDTHS[2], fontScale: 1 }).card.full;
    const smaller = createScaledTokens({ windowWidth: WIDTHS[0], fontScale: 1 }).card.full;
    expect(small.nameFont).toBeGreaterThan(smaller.nameFont);
  });

  test("the system font scale does not change the card, which is a picture", () => {
    const normal = createScaledTokens({ windowWidth: 390, fontScale: 1 }).card;
    const big = createScaledTokens({ windowWidth: 390, fontScale: 2 }).card;
    expect(big).toEqual(normal);
  });

  test("every measure keeps the hairline at least", () => {
    for (const width of WIDTHS) {
      const { compact } = createScaledTokens({ windowWidth: width, fontScale: 1 }).card;
      for (const value of Object.values(compact)) expect(value).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("the card colors reach AA", () => {
  test.each([
    ["sand on night (numbers)", palette.sand, palette.night],
    ["night on the orange band", palette.night, palette.serveOrange],
    ["night on the yellow season seal", palette.night, palette.ballYellow],
    ["yellow position on night", palette.ballYellow, palette.night],
    ["orange brand on night", palette.serveOrange, palette.night],
    ["sand initials on the avatar blue", palette.sand, cardAvatarColor],
    ["labels at 82% on night", mix(palette.sand, palette.night, LABEL_OPACITY), palette.night],
  ])("%s", (_name, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
