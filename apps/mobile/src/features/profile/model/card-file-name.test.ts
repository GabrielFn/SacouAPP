import { describe, expect, test } from "vitest";

import { cardFileName } from "./card-file-name";

describe("cardFileName", () => {
  test("is sacou-cartinha-AAAAMMDD-HHmmss.png", () => {
    expect(cardFileName(new Date(2026, 10, 21, 15, 30, 45))).toBe(
      "sacou-cartinha-20261121-153045.png",
    );
  });
  test("pads single digits", () => {
    expect(cardFileName(new Date(2026, 0, 2, 3, 4, 5))).toBe("sacou-cartinha-20260102-030405.png");
  });
  test("carries no nickname or id", () => {
    expect(cardFileName(new Date(2026, 0, 2, 3, 4, 5))).toMatch(
      /^sacou-cartinha-\d{8}-\d{6}\.png$/,
    );
  });
});
