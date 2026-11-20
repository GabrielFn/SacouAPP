import { describe, expect, test } from "vitest";

import type { MyProfile, MyStats, MyStatsTotals } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { groupRowsOf } from "./group-stats";
import { cardStatsOf, playerCardOf, statTilesOf } from "./player-card";

const ZEROS: MyStatsTotals = {
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  plusMinus: 0,
  longestWinStreak: 0,
  mvpCount: 0,
  rounds: 0,
  roundsHeld: 0,
};
const PROFILE: MyProfile = {
  nickname: "Zé",
  primaryPosition: "setter",
  otherPositions: [],
  suggestedLevel: 4,
};

describe("the card edges (E4.13 part 1, tester)", () => {
  test("zero everything: dashes for rates, zeros for counts, no NaN or Infinity", () => {
    const values = cardStatsOf(ZEROS).map((s) => s.value);
    expect(values).toEqual(["0", "—", "0", "0", "0", "—"]);
    expect(JSON.stringify(statTilesOf(ZEROS))).not.toMatch(/NaN|Infinity/);
  });

  test("presence with rounds played but none held is a dash, not a division by zero", () => {
    const stats = cardStatsOf({ ...ZEROS, rounds: 3, roundsHeld: 0 });
    expect(stats.find((s) => s.key === "presence")?.value).toBe("—");
  });

  test("presence ignores the matches played", () => {
    const stats = cardStatsOf({ ...ZEROS, matchesPlayed: 100, wins: 50, rounds: 1, roundsHeld: 4 });
    expect(stats.find((s) => s.key === "presence")?.value).toBe("25%");
  });

  test("the empty text exists in pt-BR", () => {
    expect(strings.profile.me.emptyStats).toBe("Seus números aparecem depois da primeira partida.");
  });

  test("initials: one word, accent and lower case", () => {
    const of = (nickname: string) =>
      playerCardOf({ ...PROFILE, nickname }, { year: 2026, total: ZEROS, groups: [] }).initials;
    expect(of("Zé")).toBe("ZÉ");
    expect(of("édson")).toBe("ÉD");
    expect(of("Ana Lu")).toBe("AN");
  });

  test("the model has no level, tier, rating nor Google name", () => {
    const model = playerCardOf(PROFILE, { year: 2026, total: ZEROS, groups: [] });
    const json = JSON.stringify(model).toLowerCase();
    for (const forbidden of ["level", "rating", "tier", "nota", "faixa", "google", "account"]) {
      expect(json).not.toContain(forbidden);
    }
  });

  test("a left group (null name, null modality) still gives a row", () => {
    const report: MyStats = {
      year: 2026,
      total: ZEROS,
      groups: [
        { ...ZEROS, groupId: "g", groupName: null, modality: null, matchesPlayed: 2, wins: 0 },
      ],
    };
    const rows = groupRowsOf(report);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe(strings.profile.me.formerGroup);
    expect(rows[0]?.modalityLabel).toBeNull();
    expect(rows[0]?.summary).not.toMatch(/NaN/);
  });
});
