import { describe, expect, test } from "vitest";

import type { MyStats, MyStatsGroup } from "../../../services/api/sacou-api";
import { groupRowsOf } from "./group-stats";

function group(overrides: Partial<MyStatsGroup>): MyStatsGroup {
  return {
    groupId: "g1",
    groupName: "Racha de terça",
    modality: "indoor-6x6",
    matchesPlayed: 26,
    wins: 17,
    losses: 9,
    plusMinus: 10,
    longestWinStreak: 4,
    mvpCount: 1,
    rounds: 10,
    roundsHeld: 12,
    ...overrides,
  };
}

function report(groups: readonly MyStatsGroup[]): MyStats {
  return {
    year: 2026,
    groups,
    total: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      plusMinus: 0,
      longestWinStreak: 0,
      mvpCount: 0,
      rounds: 0,
      roundsHeld: 0,
    },
  };
}

describe("Por grupo", () => {
  test("keeps the order of the server and writes the row of the drawing", () => {
    const rows = groupRowsOf(
      report([group({}), group({ groupId: "g2", groupName: "Areia", modality: "beach-4x4" })]),
    );
    expect(rows.map((row) => row.groupId)).toEqual(["g1", "g2"]);
    expect(rows[0]).toMatchObject({
      name: "Racha de terça",
      summary: "26 partidas · 65% (17 vitórias)",
      modalityLabel: "Quadra 6x6",
    });
    expect(rows[1]?.modalityLabel).toBe("Areia 4x4");
  });

  test("a group without a match is not listed", () => {
    expect(groupRowsOf(report([group({ matchesPlayed: 0, wins: 0 })]))).toEqual([]);
  });

  test("a group the person left reads Ex-jogador; a modality unknown has no chip", () => {
    const [row] = groupRowsOf(report([group({ groupName: null, modality: "snow" })]));
    expect(row?.name).toBe("Ex-jogador");
    expect(row?.modalityLabel).toBeNull();
    expect(groupRowsOf(report([group({ modality: null })]))[0]?.modalityLabel).toBeNull();
  });
});
