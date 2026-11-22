import { describe, expect, it } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import { groupRoundState, groupRoundsView } from "./group-rounds";

const START = Date.parse("2026-11-19T20:00:00Z");
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const END = START + 6 * HOUR_MS;

function round(extra: Partial<RoundSummary> = {}): RoundSummary {
  return {
    roundId: "r1",
    seriesId: null,
    localDate: "2026-11-19",
    localTime: "17:00",
    startsAt: new Date(START).toISOString(),
    endsAt: new Date(END).toISOString(),
    venue: "Ginásio Sesc",
    status: "scheduled",
    capacity: 12,
    goingCount: 3,
    waitlistCount: 0,
    me: { status: null, position: null },
    ...extra,
  };
}

function at(id: string, startsAt: number, extra: Partial<RoundSummary> = {}): RoundSummary {
  return round({
    roundId: id,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + HOUR_MS).toISOString(),
    ...extra,
  });
}

const idsOf = (items: readonly { card: { roundId: string } }[]) =>
  items.map((item) => item.card.roundId);

describe("groupRoundState: exact edges", () => {
  it("is open before the start, live from it, ended at the end", () => {
    expect(groupRoundState(round(), START - 1)).toBe("open");
    expect(groupRoundState(round(), START)).toBe("live");
    expect(groupRoundState(round(), END - 1)).toBe("live");
    expect(groupRoundState(round(), END)).toBe("ended");
  });

  it("a round closed early ends at its own endsAt", () => {
    const early = round({ endsAt: new Date(START + HOUR_MS).toISOString() });
    expect(groupRoundState(early, START + HOUR_MS)).toBe("ended");
  });

  it("a canceled round is never live", () => {
    expect(groupRoundState(round({ status: "canceled" }), START + 1)).toBe("canceled");
  });
});

describe("groupRoundsView", () => {
  it("an empty list gives two empty sections", () => {
    expect(groupRoundsView("g", [], START)).toEqual({ upcoming: [], recent: [] });
  });

  it("puts open and live rounds in upcoming, the live one first, and ended ones in recent", () => {
    const now = START + HOUR_MS;
    const view = groupRoundsView(
      "g",
      [
        at("later", now + DAY_MS),
        at("ended", START - DAY_MS),
        round({ roundId: "live" }),
        at("sooner", now + HOUR_MS),
      ],
      now,
    );
    expect(idsOf(view.upcoming)).toEqual(["live", "sooner", "later"]);
    expect(idsOf(view.recent)).toEqual(["ended"]);
  });

  it("recent is newest first", () => {
    const now = START + 3 * DAY_MS;
    const view = groupRoundsView("g", [at("old", START), at("new", START + DAY_MS)], now);
    expect(idsOf(view.recent)).toEqual(["new", "old"]);
  });

  it("a canceled round goes by its start: future in upcoming, past in recent", () => {
    const view = groupRoundsView(
      "g",
      [
        at("future", START + DAY_MS, { status: "canceled" }),
        at("past", START - DAY_MS, { status: "canceled" }),
      ],
      START,
    );
    expect(view.upcoming.map((item) => [item.card.roundId, item.state])).toEqual([
      ["future", "canceled"],
    ]);
    expect(view.recent.map((item) => [item.card.roundId, item.state])).toEqual([
      ["past", "canceled"],
    ]);
  });

  it("equal starts keep the API order", () => {
    const view = groupRoundsView("g", [at("a", START + DAY_MS), at("b", START + DAY_MS)], START);
    expect(idsOf(view.upcoming)).toEqual(["a", "b"]);
  });

  it("the ended round opens the summary, the others open the round", () => {
    const view = groupRoundsView(
      "g",
      [
        round({ roundId: "ended" }),
        at("open", END + DAY_MS),
        at("x", END + 2 * DAY_MS, { status: "canceled" }),
      ],
      END,
    );
    const targets = [...view.upcoming, ...view.recent].map((item) => [
      item.card.roundId,
      item.target,
    ]);
    expect(targets).toEqual([
      ["open", "round"],
      ["x", "round"],
      ["ended", "summary"],
    ]);
  });

  it("writes the row title and the screen reader label", () => {
    const [item] = groupRoundsView("g", [round()], START - 1).upcoming;
    expect(item?.rowTitle).toBe("Qui, 19/11 · Aberta");
    expect(item?.rowLabel).toBe("Qui, 19/11, Aberta, Ginásio Sesc");
    expect(groupRoundsView("g", [round()], END).recent[0]?.stateText).toBe(
      "Encerrada · Ver resumo",
    );
  });

  it("an invalid date does not break the text", () => {
    const [item] = groupRoundsView("g", [round({ localDate: "nope" })], START - 1).upcoming;
    expect(item?.rowTitle).toBe("nope · Aberta");
  });

  it("20 future rounds and 7 of a series are all kept", () => {
    const rounds = Array.from({ length: 27 }, (_unused, index) =>
      at(`r${String(index)}`, START + (index + 1) * DAY_MS),
    );
    expect(groupRoundsView("g", rounds, START).upcoming).toHaveLength(27);
  });
});
