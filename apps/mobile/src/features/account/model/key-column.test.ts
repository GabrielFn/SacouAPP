import { describe, expect, test } from "vitest";

import { fontScaleCap } from "../../../theme/tokens.data";
import { keyColumnBasis } from "./key-column";

describe("key column of the account card", () => {
  test("keeps 20% at the normal font and never shrinks below it", () => {
    expect(keyColumnBasis(1)).toBe("20%");
    expect(keyColumnBasis(0.8)).toBe("20%");
  });

  test("grows with the font up to the cap of the tokens", () => {
    expect(keyColumnBasis(1.15)).toBe(`${20 * 1.15}%`);
    expect(keyColumnBasis(3)).toBe(keyColumnBasis(fontScaleCap));
  });
});
