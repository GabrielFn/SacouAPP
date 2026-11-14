import { describe, expect, test } from "vitest";

import { sidesOf } from "./court-sides";

describe("sidesOf", () => {
  test("A at the left and B at the right by default", () => {
    expect(sidesOf(false)).toEqual({ left: "a", right: "b" });
  });

  test("inverted swaps the sides and inverting twice is the start again", () => {
    expect(sidesOf(true)).toEqual({ left: "b", right: "a" });
    expect(sidesOf(!true)).toEqual(sidesOf(false));
  });
});
