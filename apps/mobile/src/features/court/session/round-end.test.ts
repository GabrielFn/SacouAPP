import { describe, expect, test } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import { hasRoundEnded, roundEndOf, ROUND_LIST_TRUST_MS } from "./round-end";

const READ_AT = Date.parse("2026-11-20T12:00:00Z");
const ENDS_AT = "2026-11-19T23:00:00.000Z";

function summary(extra: Partial<RoundSummary> = {}): RoundSummary {
  return {
    roundId: "r1",
    seriesId: null,
    localDate: "2026-11-19",
    localTime: "17:00",
    startsAt: "2026-11-19T20:00:00.000Z",
    endsAt: ENDS_AT,
    venue: "Ginásio",
    status: "scheduled",
    capacity: null,
    goingCount: 0,
    waitlistCount: 0,
    me: { status: null, position: null },
    ...extra,
  };
}

describe("roundEndOf: what the cached list says of a round (R97, D4)", () => {
  test("a listed round gives its end and its date", () => {
    expect(roundEndOf({ rounds: [summary()], updatedAt: READ_AT }, "r1", READ_AT)).toEqual({
      kind: "listed",
      endsAt: Date.parse(ENDS_AT),
      localDate: "2026-11-19",
      canceled: false,
    });
  });

  test("no list is unknown", () => {
    expect(roundEndOf(undefined, "r1", READ_AT)).toEqual({ kind: "unknown" });
  });

  test("a missing round is gone while the list is under 24 h old, unknown from then on", () => {
    const list = { rounds: [], updatedAt: READ_AT };
    expect(roundEndOf(list, "r1", READ_AT + ROUND_LIST_TRUST_MS - 1)).toEqual({ kind: "gone" });
    expect(roundEndOf(list, "r1", READ_AT + ROUND_LIST_TRUST_MS)).toEqual({ kind: "unknown" });
  });
});

describe("hasRoundEnded", () => {
  const end = roundEndOf({ rounds: [summary()], updatedAt: READ_AT }, "r1", READ_AT);
  const endsAt = Date.parse(ENDS_AT);
  const GRACE = 10;

  test("ends exactly at endsAt, or at endsAt plus the grace", () => {
    expect(hasRoundEnded(end, endsAt - 1)).toBe(false);
    expect(hasRoundEnded(end, endsAt)).toBe(true);
    expect(hasRoundEnded(end, endsAt + GRACE - 1, GRACE)).toBe(false);
    expect(hasRoundEnded(end, endsAt + GRACE, GRACE)).toBe(true);
  });

  test("canceled and gone have ended; unknown and a bad endsAt are not known", () => {
    const canceled = roundEndOf(
      { rounds: [summary({ status: "canceled" })], updatedAt: READ_AT },
      "r1",
      READ_AT,
    );
    expect(hasRoundEnded(canceled, 0)).toBe(true);
    expect(hasRoundEnded({ kind: "gone" }, 0)).toBe(true);
    expect(hasRoundEnded({ kind: "unknown" }, endsAt)).toBeNull();
    const bad = { kind: "listed" as const, endsAt: Number.NaN, localDate: "", canceled: false };
    expect(hasRoundEnded(bad, endsAt)).toBeNull();
  });
});
