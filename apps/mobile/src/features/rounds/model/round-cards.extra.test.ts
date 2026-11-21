import { describe, expect, it } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import { recentRoundOf, SUMMARY_CARD_WINDOW_MS } from "./round-cards";

const START = Date.parse("2026-11-02T20:00:00Z");
const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;
const AUTO_END_MS = 6 * HOUR_MS;

function round(id: string, status: RoundSummary["status"], startsAt = START): RoundSummary {
  return {
    roundId: id,
    seriesId: null,
    localDate: "2026-11-02",
    localTime: "17:00",
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + AUTO_END_MS).toISOString(),
    status,
  } as RoundSummary;
}

describe("recentRoundOf: extra cases (E4.12 part 2, E5)", () => {
  it("a canceled round never shows, at any moment of the window", () => {
    const canceled = [round("c", "canceled")];
    const end = AUTO_END_MS + SUMMARY_CARD_WINDOW_MS;
    for (const offset of [0, 1, AUTO_END_MS, end - 1]) {
      expect(recentRoundOf(canceled, START + offset)).toBeNull();
    }
  });

  it("a canceled round does not hide an older good one", () => {
    const rounds = [round("good", "scheduled", START - 1000), round("c", "canceled")];
    expect(recentRoundOf(rounds, START + AUTO_END_MS + 10)?.roundId).toBe("good");
  });

  it("window is endsAt + 24 h, and a close before the automatic end brings it forward", () => {
    expect(SUMMARY_CARD_WINDOW_MS).toBe(DAY_HOURS * HOUR_MS);
    const auto = [round("a", "scheduled")];
    expect(recentRoundOf(auto, START + AUTO_END_MS + SUMMARY_CARD_WINDOW_MS - 1)?.roundId).toBe(
      "a",
    );
    expect(recentRoundOf(auto, START + AUTO_END_MS + SUMMARY_CARD_WINDOW_MS)).toBeNull();
    const early = [{ ...round("b", "scheduled"), endsAt: new Date(START + HOUR_MS).toISOString() }];
    expect(recentRoundOf(early, START + HOUR_MS + SUMMARY_CARD_WINDOW_MS)).toBeNull();
  });

  it("no rounds, no card", () => {
    expect(recentRoundOf([], START)).toBeNull();
  });
});
