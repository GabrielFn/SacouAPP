import { describe, expect, test } from "vitest";

import { endRoundAvailability } from "./end-round-availability";

const STARTS_AT = "2026-11-24T20:00:00.000Z";
const START_MS = Date.parse(STARTS_AT);

function availability(nowMs: number, finishedMatches: number, startsAt: string | null = STARTS_AT) {
  return endRoundAvailability({ startsAt, nowMs, finishedMatches });
}

describe("endRoundAvailability (ADR 0076)", () => {
  test("before the start time with no match finished is not started", () => {
    expect(availability(START_MS - 1, 0)).toBe("not-started");
  });

  test("a finished match opens it even before the start time", () => {
    expect(availability(START_MS - 1, 1)).toBe("open");
  });

  test("at and after the start time it is open", () => {
    expect(availability(START_MS, 0)).toBe("open");
    expect(availability(START_MS + 1, 0)).toBe("open");
  });

  test("without a usable start time the server decides", () => {
    expect(availability(0, 0, null)).toBe("open");
    expect(availability(0, 0, "nope")).toBe("open");
  });
});
