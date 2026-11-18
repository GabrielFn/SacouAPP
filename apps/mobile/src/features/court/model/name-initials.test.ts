import { describe, expect, test } from "vitest";

import { initialsOfName } from "./name-initials";

describe("initials of a name", () => {
  test("the first two letters, upper case", () => {
    expect(initialsOfName("Duda")).toBe("DU");
    expect(initialsOfName("ágata")).toBe("ÁG");
  });

  test("skips marks and keeps digits", () => {
    expect(initialsOfName("-J.o")).toBe("JO");
    expect(initialsOfName("7 Leões")).toBe("7L");
  });

  test("a name with no letter has no initials", () => {
    expect(initialsOfName("--")).toBeNull();
  });
});
