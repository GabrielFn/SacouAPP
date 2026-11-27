import { describe, expect, test } from "vitest";

import { codeOf, detailOf, errorTypeOf } from "./auth-failure-report";

const withCode = (code: unknown) => ({ error: { code } });

describe("the code and detail never carry an e-mail shape (criteria 9, 13)", () => {
  test.each(["ANA@X", "A@B.COM", "AUTH/X", "auth/a@b", "A B", "-1234567", "1.5", "ABC.DEF"])(
    "code %s is unrecognized",
    (code) => {
      expect(codeOf(withCode(code))).toBe("unrecognized");
    },
  );

  test.each(["[ A@B ]", "[ ana@x.com ]", "[auth/unknown]", "[ a ]", "[ 1234567 ]"])(
    "detail in %s is dropped",
    (message) => {
      expect(detailOf({ error: { message } })).toBeNull();
    },
  );

  test("an error type with an at sign is unrecognized", () => {
    expect(errorTypeOf({ error: { name: "A@b.com" } })).toBe("unrecognized");
  });
});
