import { describe, expect, test } from "vitest";

import { greetingText } from "./greeting";

describe("greetingText", () => {
  test("uses the nickname when there is one", () => {
    expect(greetingText("Gabi")).toBe("Fala, Gabi.");
  });

  test.each([null, undefined, "", "   "])("falls back to the plain greeting for %j", (value) => {
    expect(greetingText(value)).toBe("Fala!");
  });
});
