import type { CourtSessionState, FinishedMatch, MemberId, TeamSide } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { stateOfTimeline } from "./court-screen.selectors";
import { score, startScenario } from "./screen-scenarios.test.fixture";
import { selectWinStreak } from "./win-streak";

const SIX = 6;
const FOUR = 4;
const THREE = 3;

/** A state with `winners` already finished (oldest first) and a match open between the same teams. */
async function stateAfter(winners: readonly (TeamSide | null)[]): Promise<CourtSessionState> {
  const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
  await score(scenario, "a");
  const open = stateOfTimeline(scenario.timeline()).currentMatch;
  if (open === null) throw new Error("no open match");
  const finished = winners.map<FinishedMatch>((winner) => ({
    ...open,
    endReason: "sets-won",
    winner,
  }));
  return { currentMatch: open, finishedMatches: finished, queue: { players: [], teams: [] } };
}

describe("the streak of the team that stays", () => {
  test("no finished match, no streak", async () => {
    expect(selectWinStreak(await stateAfter([]))).toBeNull();
  });

  test("two wins in a row of the same team", async () => {
    expect(selectWinStreak(await stateAfter(["a", "a"]))).toEqual({ side: "a", count: 2 });
  });

  test("counts from the most recent and stops where another team won", async () => {
    expect(selectWinStreak(await stateAfter(["a", "a", "b", "a", "a", "a"]))).toEqual({
      side: "a",
      count: THREE,
    });
  });

  test("a last match won by the other team means the streak is theirs", async () => {
    expect(selectWinStreak(await stateAfter(["a", "a", "b"]))).toEqual({ side: "b", count: 1 });
  });

  test("a match ended by hand, without winner, breaks the streak", async () => {
    expect(selectWinStreak(await stateAfter(["a", null, "a"]))).toEqual({ side: "a", count: 1 });
  });

  test("without a match open there is no streak", async () => {
    const state = await stateAfter(["a"]);
    expect(selectWinStreak({ ...state, currentMatch: null })).toBeNull();
  });
});

describe("the majority of the current team", () => {
  /** The winners of the finished matches keep `sharing` of the six players of Laranja. */
  async function withSharedPlayers(sharing: number): Promise<CourtSessionState> {
    const state = await stateAfter(["a"]);
    const members: readonly MemberId[] = state.currentMatch?.teams.a.memberIds ?? [];
    const outsiders = Array.from(
      { length: SIX },
      (_, index) => `d0000000-0000-4000-8000-00000000000${String(index)}`,
    );
    const winners = [...members.slice(0, sharing), ...outsiders.slice(sharing)];
    const finished = state.finishedMatches[0] as FinishedMatch;
    return {
      ...state,
      finishedMatches: [{ ...finished, teams: { ...finished.teams, a: { memberIds: winners } } }],
    };
  }

  test("four of six is a majority: the streak goes on", async () => {
    expect(selectWinStreak(await withSharedPlayers(FOUR))).toEqual({ side: "a", count: 1 });
  });

  test("three of six is not: it is another team", async () => {
    expect(selectWinStreak(await withSharedPlayers(THREE))).toBeNull();
  });
});
