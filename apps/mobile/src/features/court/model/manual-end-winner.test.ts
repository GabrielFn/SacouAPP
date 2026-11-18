import type { MatchScore, TeamSide } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { stateOfTimeline } from "./court-screen.selectors";
import { manualEndWinner } from "./manual-end-winner";
import { score, startScenario } from "./screen-scenarios.test.fixture";

async function openMatch(): Promise<MatchScore> {
  const scenario = await startScenario();
  await score(scenario, "ab");
  const match = stateOfTimeline(scenario.timeline()).currentMatch;
  if (match === null || match.currentSet === null) throw new Error("no set in play");
  return match;
}

function situation(
  match: MatchScore,
  sets: { readonly a: number; readonly b: number },
  points: { readonly a: number; readonly b: number } | null,
): MatchScore {
  const set = match.currentSet;
  return {
    ...match,
    setsWon: sets,
    currentSet: points === null || set === null ? null : { ...set, score: points },
  };
}

interface Row {
  readonly name: string;
  readonly sets: { readonly a: number; readonly b: number };
  readonly points: { readonly a: number; readonly b: number } | null;
  readonly winner: TeamSide | null;
}

const TABLE: readonly Row[] = [
  { name: "sets win over points", sets: { a: 1, b: 0 }, points: { a: 5, b: 12 }, winner: "a" },
  { name: "level sets, A ahead in the set", sets: { a: 1, b: 1 }, points: { a: 10, b: 8 }, winner: "a" },
  { name: "level sets, B ahead in the set", sets: { a: 1, b: 1 }, points: { a: 8, b: 10 }, winner: "b" },
  { name: "level sets and level points", sets: { a: 1, b: 1 }, points: { a: 9, b: 9 }, winner: null },
  { name: "first set at 0-0", sets: { a: 0, b: 0 }, points: { a: 0, b: 0 }, winner: null },
  { name: "single set at 20-18", sets: { a: 0, b: 0 }, points: { a: 20, b: 18 }, winner: "a" },
  { name: "level sets and no set in play", sets: { a: 1, b: 1 }, points: null, winner: null },
  { name: "B ahead in sets", sets: { a: 0, b: 1 }, points: { a: 3, b: 0 }, winner: "b" },
];

describe("who wins a match ended by hand (answer 7)", () => {
  test.each(TABLE)("$name", async ({ sets, points, winner }) => {
    const match = await openMatch();
    expect(manualEndWinner(situation(match, sets, points))).toBe(winner);
  });
});
