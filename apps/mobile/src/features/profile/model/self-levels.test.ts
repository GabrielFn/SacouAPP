import { describe, expect, test } from "vitest";

import { levelCardsStacked } from "./self-levels";

describe("levelCardsStacked", () => {
  test.each([
    [1, false],
    [1.15, false],
    [1.3, true],
    [2, true],
  ])("font scale %s stacked: %s", (fontScale, expected) => {
    expect(levelCardsStacked(fontScale)).toBe(expected);
  });
});
