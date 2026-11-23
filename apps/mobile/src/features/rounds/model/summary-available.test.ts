import { describe, expect, test } from "vitest";

import type { Round } from "../../../services/api/sacou-api";
import { summaryAvailable } from "./round-detail";

const STARTS_AT = "2026-11-03T20:30:00Z";
const START_MS = Date.parse(STARTS_AT);
const HOUR_MS = 3_600_000;

function round(status: Round["status"]): Round {
  return { startsAt: STARTS_AT, status } as Round;
}

describe("summaryAvailable (question 152)", () => {
  test("opens when the round starts, not before", () => {
    expect(summaryAvailable(round("scheduled"), START_MS - 1)).toBe(false);
    expect(summaryAvailable(round("scheduled"), START_MS)).toBe(true);
    expect(summaryAvailable(round("scheduled"), START_MS + HOUR_MS)).toBe(true);
  });

  test("never for a canceled round", () => {
    expect(summaryAvailable(round("canceled"), START_MS + HOUR_MS)).toBe(false);
  });

  test("a round closed before its start has a summary too (R99)", () => {
    const early = (endsAt: number, status: Round["status"] = "scheduled") =>
      ({ startsAt: STARTS_AT, endsAt: new Date(endsAt).toISOString(), status }) as Round;
    const now = START_MS - HOUR_MS;
    expect(summaryAvailable(early(now), now)).toBe(true);
    expect(summaryAvailable(early(now + 1), now)).toBe(false);
    expect(summaryAvailable(early(now - 1, "canceled"), now)).toBe(false);
  });
});
