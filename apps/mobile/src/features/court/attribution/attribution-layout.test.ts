import { describe, expect, test } from "vitest";

import { attributionLayoutFor } from "./attribution-layout";

describe("attributionLayoutFor", () => {
  test("the court on its side splits the sheet in two columns", () => {
    expect(attributionLayoutFor(780, 360)).toBe("columns");
  });

  test("upright follows the prototype, stacked", () => {
    expect(attributionLayoutFor(390, 844)).toBe("stacked");
  });

  test("a square window stacks", () => {
    expect(attributionLayoutFor(500, 500)).toBe("stacked");
  });
});
