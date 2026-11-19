import { describe, expect, test } from "vitest";

import { quickActionsDirection } from "./corrections-layout";

describe("quickActionsDirection", () => {
  test("on its side (780 x 360) the actions stack so the label fits whole", () => {
    expect(quickActionsDirection(780, 360)).toBe("column");
  });

  test("upright follows the prototype, side by side", () => {
    expect(quickActionsDirection(390, 844)).toBe("row");
  });
});
