import { describe, expect, test } from "vitest";

import { groupByDay, type DayClock } from "./group-by-day";
import { notification } from "./notification.test.fixture";

/** Brasília, three hours behind UTC. */
const BRASILIA = 180;
/** Thursday 19/11/2026, 10h00 in Brasília. */
const NOW = Date.parse("2026-11-19T13:00:00.000Z");
const CLOCK: DayClock = { nowMs: NOW, offsetMinutes: BRASILIA };

describe("M4 groupByDay", () => {
  test("today, yesterday, a weekday of this week and a date of before, newest first", () => {
    const groups = groupByDay(
      [
        notification({ id: "a", createdAt: "2026-11-19T12:00:00.000Z" }),
        notification({ id: "b", createdAt: "2026-11-18T23:10:00.000Z" }),
        notification({ id: "c", createdAt: "2026-11-17T02:05:00.000Z" }),
        notification({ id: "d", createdAt: "2026-11-10T15:00:00.000Z" }),
      ],
      CLOCK,
    );
    expect(groups.map((group) => group.label)).toEqual(["Hoje", "Ontem", "Segunda", "10/11"]);
    expect(groups.map((group) => group.items.map((row) => row.item.id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
      ["d"],
    ]);
    expect(groups[0]?.items[0]?.time).toBe("9h00");
    expect(groups[1]?.items[0]?.time).toBe("20h10");
    expect(groups[2]?.items[0]?.time).toBe("23h05");
  });

  test("two of the same day stay together, in the order of the server", () => {
    const groups = groupByDay(
      [
        notification({ id: "a", createdAt: "2026-11-19T12:00:00.000Z" }),
        notification({ id: "b", createdAt: "2026-11-19T11:12:00.000Z" }),
      ],
      CLOCK,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((row) => row.item.id)).toEqual(["a", "b"]);
  });

  test("around midnight the day is the phone's, not UTC's", () => {
    const justAfterMidnight: DayClock = {
      nowMs: Date.parse("2026-11-20T03:01:00.000Z"),
      offsetMinutes: BRASILIA,
    };
    const groups = groupByDay(
      [
        notification({ id: "new", createdAt: "2026-11-20T03:00:30.000Z" }),
        notification({ id: "old", createdAt: "2026-11-20T02:59:00.000Z" }),
      ],
      justAfterMidnight,
    );
    expect(groups.map((group) => [group.label, group.items[0]?.time])).toEqual([
      ["Hoje", "0h00"],
      ["Ontem", "23h59"],
    ]);
  });

  test("six days back is a weekday, seven is a date", () => {
    const groups = groupByDay(
      [
        notification({ id: "six", createdAt: "2026-11-13T13:00:00.000Z" }),
        notification({ id: "seven", createdAt: "2026-11-12T13:00:00.000Z" }),
      ],
      CLOCK,
    );
    expect(groups.map((group) => group.label)).toEqual(["Sexta", "12/11"]);
  });

  test("Sunday is named and an unreadable date goes to today", () => {
    const groups = groupByDay(
      [
        notification({ id: "bad", createdAt: "not a date" }),
        notification({ id: "sunday", createdAt: "2026-11-15T13:00:00.000Z" }),
      ],
      CLOCK,
    );
    expect(groups.map((group) => group.label)).toEqual(["Hoje", "Domingo"]);
  });

  test("an empty list has no group", () => {
    expect(groupByDay([], CLOCK)).toEqual([]);
  });
});
