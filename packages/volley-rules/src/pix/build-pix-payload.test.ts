import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { err, ok } from "../result.js";
import { buildPixPayload } from "./build-pix-payload.js";
import { PIX_KEY_TYPES } from "./constants.data.js";
import type { PixPayloadError, PixPayloadInput } from "./types.js";

interface GoldenCaseBase {
  readonly id: string;
  readonly source: string;
  readonly input: PixPayloadInput;
}

interface PayloadGoldenCase extends GoldenCaseBase {
  readonly expectedPayload: string;
}

interface ErrorGoldenCase extends GoldenCaseBase {
  readonly expectedError: PixPayloadError["code"];
}

type PixGoldenCase = PayloadGoldenCase | ErrorGoldenCase;

const GOLDEN_URL = new URL("../../golden/pix.json", import.meta.url);
const GOLDEN_CASES = JSON.parse(readFileSync(GOLDEN_URL, "utf8")) as readonly PixGoldenCase[];
const ERROR_CASES = GOLDEN_CASES.filter(
  (goldenCase): goldenCase is ErrorGoldenCase => "expectedError" in goldenCase,
);

const VALID_INPUT: PixPayloadInput = {
  key: { type: "random", value: "123e4567-e12b-12d1-a456-426655440000" },
  merchantName: "Fulano de Tal",
  merchantCity: "BRASILIA",
};

/** A text that passes every check once coerced, so accepting a non-string would forge a field. */
const FORGED_TEXT = "fulano@example.com";

const NON_STRING_VALUES = [
  { label: "array", value: [FORGED_TEXT] },
  { label: "number", value: 12345678900 },
  { label: "null", value: null },
  { label: "object with toString", value: { toString: () => FORGED_TEXT } },
] as const;

describe("buildPixPayload", () => {
  test.each(GOLDEN_CASES)("golden $id", (goldenCase) => {
    const expected =
      "expectedError" in goldenCase
        ? err({ code: goldenCase.expectedError })
        : ok(goldenCase.expectedPayload);
    expect(buildPixPayload(goldenCase.input)).toEqual(expected);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects the non-finite amount %s",
    (amountCents) => {
      expect(buildPixPayload({ ...VALID_INPUT, amountCents })).toEqual(
        err({ code: "invalid-amount" }),
      );
    },
  );

  test("fails closed on a key type unknown at run time", () => {
    const key = { type: "constructor", value: "12345678900" } as unknown as PixPayloadInput["key"];
    expect(buildPixPayload({ ...VALID_INPUT, key })).toEqual(err({ code: "invalid-key" }));
  });

  describe.each(NON_STRING_VALUES)("with the non-string value $label", ({ value }) => {
    const untrusted = value as unknown as string;

    test.each(PIX_KEY_TYPES)("rejects it as a key of type %s", (type) => {
      const result = buildPixPayload({ ...VALID_INPUT, key: { type, value: untrusted } });
      expect(result).toEqual(err({ code: "invalid-key" }));
      expect(JSON.stringify(result)).not.toContain(FORGED_TEXT);
    });

    test("rejects it as a merchant name", () => {
      const result = buildPixPayload({ ...VALID_INPUT, merchantName: untrusted });
      expect(result).toEqual(err({ code: "invalid-merchant-name" }));
      expect(JSON.stringify(result)).not.toContain(FORGED_TEXT);
    });

    test("rejects it as a merchant city", () => {
      const result = buildPixPayload({ ...VALID_INPUT, merchantCity: untrusted });
      expect(result).toEqual(err({ code: "invalid-merchant-city" }));
      expect(JSON.stringify(result)).not.toContain(FORGED_TEXT);
    });
  });

  test.each([null, undefined, "12345678900", 1])("rejects %s in place of the key", (key) => {
    const result = buildPixPayload({
      ...VALID_INPUT,
      key: key as unknown as PixPayloadInput["key"],
    });
    expect(result).toEqual(err({ code: "invalid-key" }));
  });

  test("rejects a key whose type is not a string", () => {
    const key = { type: ["cpf"], value: "12345678900" } as unknown as PixPayloadInput["key"];
    expect(buildPixPayload({ ...VALID_INPUT, key })).toEqual(err({ code: "invalid-key" }));
  });

  test.each(ERROR_CASES)("the error of $id carries only its code", ({ input }) => {
    const result = buildPixPayload(input);
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.error)).toEqual(["code"]);
    [input.key.value, input.merchantName, input.merchantCity]
      .filter((sensitive) => sensitive !== "")
      .forEach((sensitive) => {
        expect(serialized).not.toContain(sensitive);
      });
  });
});
