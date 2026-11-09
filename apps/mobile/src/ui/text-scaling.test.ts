import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createScaledTokens } from "../theme/scale";
import { fontScaleCap, fontSizes } from "../theme/tokens.data";
import { TEXT_SCALING_PROPS } from "./text-scaling";

describe("the text is scaled once", () => {
  it("the tokens already carry the font scale, capped", () => {
    const big = createScaledTokens({ windowWidth: 390, fontScale: 3 });
    expect(big.fontSizes.body).toBe(Math.round(fontSizes.body * fontScaleCap));
  });

  it("grows below the cap, by the exact scale", () => {
    const mid = createScaledTokens({ windowWidth: 390, fontScale: 1.2 });
    expect(mid.fontSizes.body).toBe(Math.round(fontSizes.body * 1.2));
  });

  it("so the native text does not scale it again", () => {
    expect(TEXT_SCALING_PROPS.allowFontScaling).toBe(false);
  });

  it("and the base Text spreads that before the style", () => {
    const source = readFileSync(new URL("./Text.tsx", import.meta.url), "utf8");
    expect(source).toContain("{...TEXT_SCALING_PROPS}");
  });
});
