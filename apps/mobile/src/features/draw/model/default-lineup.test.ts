import type { MemberId } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { defaultLineup, type PrimaryPosition } from "./default-lineup";

/** A team of six named by position: the key is the member, the value what their profile says. */
function teamOf(profiles: readonly (readonly [MemberId, PrimaryPosition])[]) {
  const positions = new Map(profiles);
  return {
    team: profiles.map(([memberId]) => memberId),
    positionOf: (memberId: MemberId) => positions.get(memberId) ?? null,
  };
}

describe("defaultLineup: each slot takes who plays its position, in order of arrival (D6)", () => {
  test.each([
    {
      name: "5x1 with one of each: S, OH1, MB1, OPP, OH2, MB2",
      system: "5x1" as const,
      profiles: [
        ["oh1", "outsideHitter"],
        ["mb1", "middleBlocker"],
        ["opp", "opposite"],
        ["s", "setter"],
        ["oh2", "outsideHitter"],
        ["mb2", "middleBlocker"],
      ] as const,
      lineup: ["s", "oh1", "mb1", "opp", "oh2", "mb2"],
    },
    {
      name: "5x1 with two setters: the first is S, the other takes the next free slot",
      system: "5x1" as const,
      profiles: [
        ["s1", "setter"],
        ["s2", "setter"],
        ["oh1", "outsideHitter"],
        ["oh2", "outsideHitter"],
        ["mb1", "middleBlocker"],
        ["mb2", "middleBlocker"],
      ] as const,
      lineup: ["s1", "oh1", "mb1", "s2", "oh2", "mb2"],
    },
    {
      name: "nobody with a position: order of arrival",
      system: "5x1" as const,
      profiles: [
        ["p1", null],
        ["p2", "any"],
        ["p3", null],
        ["p4", "any"],
        ["p5", null],
        ["p6", null],
      ] as const,
      lineup: ["p1", "p2", "p3", "p4", "p5", "p6"],
    },
    {
      name: "6x2 with two setters: indexes 0 and 3",
      system: "6x2" as const,
      profiles: [
        ["oh1", "outsideHitter"],
        ["s1", "setter"],
        ["mb1", "middleBlocker"],
        ["s2", "setter"],
        ["oh2", "outsideHitter"],
        ["mb2", "middleBlocker"],
      ] as const,
      lineup: ["s1", "oh1", "mb1", "s2", "oh2", "mb2"],
    },
    {
      name: "6x2 with one setter and an opposite: the opposite takes S2",
      system: "6x2" as const,
      profiles: [
        ["opp", "opposite"],
        ["s1", "setter"],
        ["oh1", "outsideHitter"],
        ["mb1", "middleBlocker"],
        ["x", "any"],
        ["mb2", "middleBlocker"],
      ] as const,
      lineup: ["s1", "oh1", "mb1", "opp", "x", "mb2"],
    },
    {
      name: "4x2 follows the slots of the 6x2",
      system: "4x2" as const,
      profiles: [
        ["s1", "setter"],
        ["s2", "setter"],
        ["oh1", "outsideHitter"],
        ["oh2", "outsideHitter"],
        ["mb1", "middleBlocker"],
        ["mb2", "middleBlocker"],
      ] as const,
      lineup: ["s1", "oh1", "mb1", "s2", "oh2", "mb2"],
    },
    {
      name: "a libero is treated as any position",
      system: "5x1" as const,
      profiles: [
        ["l", "libero"],
        ["s", "setter"],
        ["oh1", "outsideHitter"],
        ["mb1", "middleBlocker"],
        ["opp", "opposite"],
        ["oh2", "outsideHitter"],
      ] as const,
      lineup: ["s", "oh1", "mb1", "opp", "oh2", "l"],
    },
    {
      name: "the free system keeps the order of arrival",
      system: "livre" as const,
      profiles: [
        ["oh1", "outsideHitter"],
        ["s", "setter"],
        ["mb1", "middleBlocker"],
        ["opp", "opposite"],
        ["oh2", "outsideHitter"],
        ["mb2", "middleBlocker"],
      ] as const,
      lineup: ["oh1", "s", "mb1", "opp", "oh2", "mb2"],
    },
  ])("$name", ({ system, profiles, lineup }) => {
    const { team, positionOf } = teamOf(profiles);

    const built = defaultLineup(team, system, positionOf);
    const result = built.ok ? built.value : [];

    expect(result).toEqual(lineup);
    expect(new Set(result).size).toBe(team.length);
    expect([...result].sort()).toEqual([...team].sort());
  });
});

describe("defaultLineup: a team that cannot fill six seats is an error", () => {
  const positionOf = () => null;

  test("five or seven members", () => {
    expect(defaultLineup(["a", "b", "c", "d", "e"], "5x1", positionOf)).toEqual({
      ok: false,
      error: "wrong-team-size",
    });
    expect(defaultLineup(["a", "b", "c", "d", "e", "f", "g"], "livre", positionOf).ok).toBe(false);
  });
});
