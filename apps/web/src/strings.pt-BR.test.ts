import { describe, expect, it } from "vitest";
import { webStrings } from "./strings.pt-BR";

describe("ops.percent", () => {
  it.each([
    [0.596, "59%"],
    [0.6, "60%"],
    [0.29, "29%"],
    [0, "0%"],
    [1, "100%"],
  ])("formats %s as %s, rounding down", (share, expected) => {
    expect(webStrings.ops.percent(share)).toBe(expected);
  });
});
