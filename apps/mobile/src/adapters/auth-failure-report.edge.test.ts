import { describe, expect, test } from "vitest";

import { codeOf, detailOf, errorTypeOf, framesOf } from "./auth-failure-report";

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

describe("a rewritten e-mail fits no known code, detail or type (review of #274)", () => {
  test.each(["auth/ana-x-com", "auth/ana-silva-gmail-com", "ANA_SILVA_GMAIL_COM", "123456", "-10"])(
    "code %s is unrecognized",
    (code) => {
      expect(codeOf(withCode(code))).toBe("unrecognized");
    },
  );

  test.each([
    [10, "10"],
    ["12500", "12500"],
    ["auth/internal-error", "auth/internal-error"],
    ["auth/unknown", "auth/unknown"],
    ["PLAY_SERVICES_NOT_AVAILABLE", "PLAY_SERVICES_NOT_AVAILABLE"],
  ])("the real code %s leaves as %s", (code, expected) => {
    expect(codeOf(withCode(code))).toBe(expected);
  });

  test.each([
    ["[auth/unknown] An internal error has occurred. [ ANA_SILVA_GMAIL_COM ]", null],
    ["[ 123456: ]", null],
    ["[ INVALID_CERT_HASH ]", "INVALID_CERT_HASH"],
    ["[ ANA_SILVA_GMAIL_COM ] then [ CONFIGURATION_NOT_FOUND ]", "CONFIGURATION_NOT_FOUND"],
  ])("detail in %s is %s", (message, expected) => {
    expect(detailOf({ error: { message } })).toBe(expected);
  });

  test.each([
    ["FirebaseError", "FirebaseError"],
    ["TypeError", "TypeError"],
    ["xYz9aBcDeFgHiJkLmNoPqRsTuV12", "unrecognized"],
    ["eyJhbGciOiJIUzI1NiJ9", "unrecognized"],
    [`A${"b".repeat(40)}`, "unrecognized"],
  ])("error type %s is %s", (name, expected) => {
    expect(errorTypeOf({ error: { name } })).toBe(expected);
  });
});

describe("only the real frame lines of the stack leave (review of #274)", () => {
  const hermes = [
    "    at signIn (address at index.android.bundle:1:123456)",
    "    at anonymous (native)",
    "    at ?anon_0_ (http://10.0.2.2:8081/index.bundle:120:34)",
  ];
  const v8 = ["    at Object.<anonymous> (/app/src/x.ts:3:9)", "    at node:internal/main:36:49"];

  test("frames of Hermes and V8 pass", () => {
    const stack = ["Error: falhou", ...hermes, ...v8].join("\n");
    expect(framesOf({ error: { stack } })).toEqual([...hermes, ...v8]);
  });

  test.each(["\tat Ana Silva", "    at Ana Silva (sem local)", "    at ", "at"])(
    "the line %j is dropped",
    (line) => {
      expect(framesOf({ error: { stack: `Error: x\n${line}` } })).toEqual([]);
    },
  );
});
