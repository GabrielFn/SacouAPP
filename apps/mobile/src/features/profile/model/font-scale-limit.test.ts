import { describe, expect, test } from "vitest";

import { STACK_FROM_FONT_SCALE } from "../../../theme/font-scale-limits";
import { levelCardsStacked } from "./self-levels";

describe("the level cards follow STACK_FROM_FONT_SCALE", () => {
  test("stacked only above the limit", () => {
    expect(levelCardsStacked(STACK_FROM_FONT_SCALE)).toBe(false);
    expect(levelCardsStacked(STACK_FROM_FONT_SCALE + 0.01)).toBe(true);
    expect(levelCardsStacked(STACK_FROM_FONT_SCALE - 0.01)).toBe(false);
  });
});
