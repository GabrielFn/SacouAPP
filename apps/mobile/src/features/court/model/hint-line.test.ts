import { describe, expect, test } from "vitest";

import { selectHintLine } from "./hint-line";

describe("the line of the middle strip", () => {
  test("by default it says the positions are those of the serve", () => {
    expect(selectHintLine([])).toEqual({ kind: "positions" });
  });

  test("one team at set point: one more point and it closes the set", () => {
    expect(selectHintLine(["a"])).toEqual({ kind: "closes-set", side: "a" });
    expect(selectHintLine(["b"])).toEqual({ kind: "closes-set", side: "b" });
  });

  test("both teams at set point: whoever scores next closes it", () => {
    expect(selectHintLine(["a", "b"])).toEqual({ kind: "next-point-closes" });
  });
});

describe("the draw of who serves in a next match", () => {
  test("it shows the drawn side, ahead of the default line", () => {
    expect(selectHintLine([], "b")).toEqual({ kind: "first-server-drawn", side: "b" });
  });
});
