import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { crc16CcittFalse } from "./crc16.js";

interface CrcGoldenCase {
  readonly id: string;
  readonly source: string;
  readonly ascii: string;
  readonly expectedCrc: string;
}

const GOLDEN_URL = new URL("../../golden/pix-crc.json", import.meta.url);
const GOLDEN_CASES = JSON.parse(readFileSync(GOLDEN_URL, "utf8")) as readonly CrcGoldenCase[];

describe("crc16CcittFalse", () => {
  test.each(GOLDEN_CASES)("golden $id", ({ ascii, expectedCrc }) => {
    expect(crc16CcittFalse(ascii)).toBe(expectedCrc);
  });

  test("the golden keeps a CRC that starts with zero, to pin the padding", () => {
    expect(GOLDEN_CASES.some(({ expectedCrc }) => expectedCrc.startsWith("0"))).toBe(true);
  });
});
