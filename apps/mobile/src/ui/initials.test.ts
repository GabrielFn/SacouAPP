import { describe, expect, test } from "vitest";

import { initialsOfName } from "./initials";

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

describe("initialsOfName, the one function of the avatars", () => {
  test("composes a combining accent", () => {
    expect(initialsOfName("João")).toBe("JO");
  });

  test("takes the first two letters of two words, and one letter of a one-letter nickname", () => {
    expect(initialsOfName("Ana Lu")).toBe("AN");
    expect(initialsOfName("Z")).toBe("Z");
  });

  test("skips a leading emoji", () => {
    expect(initialsOfName("🏐Beto")).toBe("BE");
  });
});
