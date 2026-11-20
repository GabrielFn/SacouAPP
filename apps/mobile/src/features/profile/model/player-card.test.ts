import { describe, expect, test } from "vitest";

import type { MyStats, MyStatsTotals, MyProfile } from "../../../services/api/sacou-api";
import {
  cardAccessibilityLabel,
  formatPercent,
  formatSigned,
  playerCardOf,
  positionLineOf,
  statTilesOf,
} from "./player-card";

const TOTALS: MyStatsTotals = {
  matchesPlayed: 48,
  wins: 30,
  losses: 18,
  plusMinus: 112,
  longestWinStreak: 7,
  mvpCount: 4,
  rounds: 23,
  roundsHeld: 25,
};

function report(total: Partial<MyStatsTotals> = {}, year = 2026): MyStats {
  return { year, total: { ...TOTALS, ...total }, groups: [] };
}

const PROFILE: MyProfile = {
  nickname: "João",
  primaryPosition: "outsideHitter",
  otherPositions: ["opposite"],
  suggestedLevel: 3,
};

function valuesOf(stats: MyStats, profile: MyProfile = PROFILE) {
  return Object.fromEntries(playerCardOf(profile, stats).stats.map((s) => [s.key, s.value]));
}

describe("the numbers of the drawing", () => {
  test("48 matches, 30 wins, +112, 7, 4 and 23 of 25 rounds", () => {
    expect(valuesOf(report())).toEqual({
      matches: "48",
      winRate: "63%",
      plusMinus: "+112",
      longestStreak: "7",
      mvpCount: "4",
      presence: "92%",
    });
  });

  test("the tiles say wins with the rate, and the rounds played", () => {
    const tiles = Object.fromEntries(statTilesOf(TOTALS).map((t) => [t.key, [t.value, t.label]]));
    expect(tiles.wins).toEqual(["30", "vitórias · 63%"]);
    expect(tiles.rounds).toEqual(["23", "rodadas"]);
  });

  test("the presence is rounds played over rounds held, not matches", () => {
    expect(valuesOf(report({ rounds: 5, roundsHeld: 10, matchesPlayed: 48 })).presence).toBe("50%");
  });
});

describe("percentages are whole numbers, half up", () => {
  test.each([
    [0, 0, "—"],
    [0, 5, "0%"],
    [1, 3, "33%"],
    [2, 3, "67%"],
    [1, 8, "13%"],
    [5, 5, "100%"],
    [26, 40, "65%"],
  ])("%i of %i is %s", (part, whole, expected) => {
    expect(formatPercent(part, whole)).toBe(expected);
  });

  test("no base is a dash, never NaN", () => {
    expect(valuesOf(report({ matchesPlayed: 0, wins: 0 })).winRate).toBe("—");
    expect(valuesOf(report({ roundsHeld: 0, rounds: 0 })).presence).toBe("—");
  });
});

describe("the balance and the MVPs", () => {
  test("signs", () => {
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(112)).toBe("+112");
    expect(formatSigned(-5)).toBe("−5");
    expect(formatSigned(1234)).toBe("+1234");
  });

  test("zero MVPs is the number 0", () => {
    expect(valuesOf(report({ mvpCount: 0 })).mvpCount).toBe("0");
  });
});

describe("the position", () => {
  test("main and others", () => {
    const card = playerCardOf(PROFILE, report());
    expect(card.positionLabel).toBe("Ponteiro");
    expect(card.otherPositionsLabel).toBe("também oposto");
    expect(card.showGlyph).toBe(true);
    expect(positionLineOf(PROFILE)).toBe("Ponteiro · também oposto");
  });

  test("two others", () => {
    const profile: MyProfile = { ...PROFILE, otherPositions: ["opposite", "middleBlocker"] };
    expect(playerCardOf(profile, report()).otherPositionsLabel).toBe("também oposto e central");
  });

  test("any position has no glyph; none has no line and no glyph", () => {
    const any = playerCardOf({ ...PROFILE, primaryPosition: "any", otherPositions: [] }, report());
    expect(any.positionLabel).toBe("Qualquer uma");
    expect(any.showGlyph).toBe(false);
    const none = playerCardOf({ ...PROFILE, primaryPosition: null, otherPositions: [] }, report());
    expect(none.positionLabel).toBeNull();
    expect(none.showGlyph).toBe(false);
    expect(positionLineOf({ ...PROFILE, primaryPosition: null, otherPositions: [] })).toBeNull();
  });

  test("a profile restored from disk (nickname only) has no position", () => {
    const card = playerCardOf({ nickname: "João" }, report());
    expect(card.positionLabel).toBeNull();
    expect(card.showGlyph).toBe(false);
  });
});

describe("the season and the initials", () => {
  test("the year is the one the server answered", () => {
    expect(playerCardOf(PROFILE, report({}, 2027)).seasonLabel).toBe("Temporada 2027");
  });

  test("the initials of the nickname", () => {
    expect(playerCardOf(PROFILE, report()).initials).toBe("JO");
  });
});

describe("no level reaches the card (ADR 0047)", () => {
  test("a report with extra fields does not carry them to the model", () => {
    const wire = {
      ...report(),
      rating: 1600,
      total: { ...TOTALS, mu: 25, sigma: 8, level: 4 },
    };
    const card = playerCardOf({ ...PROFILE, suggestedLevel: 4.5 }, wire);
    const text = JSON.stringify(card);
    expect(Object.keys(card).sort()).toEqual(
      [
        "initials",
        "nickname",
        "otherPositionsLabel",
        "positionLabel",
        "seasonLabel",
        "showGlyph",
        "stats",
      ].sort(),
    );
    for (const forbidden of ["1600", "rating", "mu", "sigma", "level", "tier", "Bronze", "Elite"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("the model has the six stats and no more", () => {
    expect(playerCardOf(PROFILE, report()).stats.map((s) => s.key)).toEqual([
      "matches",
      "winRate",
      "plusMinus",
      "longestStreak",
      "mvpCount",
      "presence",
    ]);
  });
});

describe("the label for the screen reader", () => {
  test("with the numbers", () => {
    const label = cardAccessibilityLabel(playerCardOf(PROFILE, report()), true);
    expect(label).toBe(
      "Sua cartinha: ponteiro, 48 partidas, 63% de vitórias, saldo +112, maior sequência 7, 4 vezes MVP, 92% de presença",
    );
  });

  test("hidden, it says no number", () => {
    const label = cardAccessibilityLabel(playerCardOf(PROFILE, report()), false);
    expect(label).toBe("Sua cartinha: ponteiro");
    expect(label).not.toMatch(/\d/);
  });
});
