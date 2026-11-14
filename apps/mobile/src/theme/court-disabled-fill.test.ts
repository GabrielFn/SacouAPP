import { describe, expect, test } from "vitest";

import { contrastRatio } from "./contrast";
import { courtDisabledFill, courtPalette } from "./tokens.data";

const AA_TEXT = 4.5;
const LABELS = [courtPalette.sun.background, courtPalette.night.background] as const;

describe("the fill of a disabled court button", () => {
  test.each(LABELS)("keeps AA contrast with the label color %s", (label) => {
    const result = contrastRatio(courtDisabledFill, label);
    expect(result.ok ? result.value : 0).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
