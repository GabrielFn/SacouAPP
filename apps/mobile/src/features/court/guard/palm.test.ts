import { describe, expect, test } from "vitest";

import { isPalmTouch, nextPeakTouches } from "./palm";

describe("a palm on the screen", () => {
  test("one finger is a tap; two or more are a palm", () => {
    expect(isPalmTouch(1)).toBe(false);
    expect(isPalmTouch(2)).toBe(true);
    expect(isPalmTouch(5)).toBe(true);
  });

  test("no touch at all is not a palm", () => {
    expect(isPalmTouch(0)).toBe(false);
  });
});

describe("the peak of fingers in one gesture", () => {
  test("a second finger raises the peak, a third raises it again", () => {
    expect(nextPeakTouches(1, 2)).toBe(2);
    expect(nextPeakTouches(2, 3)).toBe(3);
    expect(nextPeakTouches(3, 2)).toBe(3);
  });

  test("a single finger down starts a new gesture, whatever the last one was", () => {
    expect(nextPeakTouches(3, 1)).toBe(1);
  });

  test("two fingers landing together are a palm from the first event", () => {
    expect(isPalmTouch(nextPeakTouches(1, 2))).toBe(true);
  });
});
