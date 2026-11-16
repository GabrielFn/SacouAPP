import { describe, expect, test } from "vitest";

import { contrastRatio } from "./contrast";
import { dayStripSwatches } from "./themes";
import { palette } from "./tokens.data";

const AA_TEXT = 4.5;

function ratio(first: string, second: string): number {
  const result = contrastRatio(first, second);
  return result.ok ? result.value : 0;
}

describe("the colors of the round cards", () => {
  test.each(dayStripSwatches)("the day strip $fill keeps AA with its text $text", ({ fill, text }) => {
    expect(ratio(fill, text)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  test("the Lista cheia pill keeps AA", () => {
    expect(ratio(palette.goingFill, palette.goingText)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
