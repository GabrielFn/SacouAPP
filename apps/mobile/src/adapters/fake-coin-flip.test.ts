import { describe, expect, test } from "vitest";

import { createFakeCoinFlip } from "./fake-coin-flip";

describe("the fake coin", () => {
  test("gives the sides in order, then starts again", () => {
    const coin = createFakeCoinFlip(["b", "a"]);
    expect([coin.flip(), coin.flip(), coin.flip()]).toEqual(["b", "a", "b"]);
  });
});
