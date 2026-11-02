import { describe, expect, test } from "vitest";

import { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import type { EventEnvelope } from "../event-log/types.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import { MATCH_ID, matchInput, replayAll, toEnvelope } from "./match-player.test.fixture.js";
import type {
  CourtSessionState,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoringRules,
  TeamSide,
} from "./types.js";

const MD3_REAL: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const MD5_REAL: ScoringRules = { bestOf: 5, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };

type Command = (state: CourtSessionState) => ScoreCommandResult;

/** Plays commands as the app does: every draft becomes an envelope and the state is replayed. */
class Player {
  readonly events: EventEnvelope[] = [];

  constructor(scoring: ScoringRules) {
    this.run((state) => startMatch(state, matchInput(scoring)));
  }

  state(): CourtSessionState {
    return replayAll(this.events);
  }

  try(command: Command): ScoreCommandResult {
    const result = command(this.state());
    if (result.ok) {
      result.value.forEach((draft) => {
        this.events.push(toEnvelope(draft, this.events.length + 1));
      });
    }
    return result;
  }

  run(command: Command): readonly ScoreEventDraft[] {
    const result = this.try(command);
    if (!result.ok) {
      throw new Error(`refused: ${result.error.code}`);
    }
    return result.value;
  }

  points(team: TeamSide, count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.run((state) => scorePoint(state, team));
    }
  }

  /** Points alternate, the loser first, so a set never ends before the winner's last run. */
  playSet(winner: TeamSide, winnerPoints: number, loserPoints: number): void {
    const loser: TeamSide = winner === "a" ? "b" : "a";
    for (let index = 0; index < loserPoints; index += 1) {
      this.points(loser, 1);
      this.points(winner, 1);
    }
    this.points(winner, winnerPoints - loserPoints);
    this.run(confirmSetEnd);
  }

  revertTo(index: number): void {
    const target = this.events[index];
    if (target === undefined) {
      throw new Error("no such event");
    }
    const draft = {
      type: REVERTED_TO_EVENT_TYPE,
      payload: { targetEventId: target.eventId },
    } as unknown as ScoreEventDraft;
    this.events.push(toEnvelope(draft, this.events.length + 1));
  }
}

function refusal(code: string): ScoreCommandResult {
  return { ok: false, error: { code } } as ScoreCommandResult;
}

describe("a real best-of-3 with tie-break, played by commands to the end", () => {
  test("25-20, 23-25, then the 15-point tie-break goes to advantage 17-15", () => {
    const player = new Player(MD3_REAL);
    player.playSet("a", 25, 20);
    expect(player.state().currentMatch?.currentSet?.targetPoints).toBe(25);
    player.playSet("b", 25, 23);
    expect(player.state().currentMatch?.currentSet?.targetPoints).toBe(15);

    player.points("a", 14);
    player.points("b", 14);
    expect(player.try(confirmSetEnd)).toStrictEqual(refusal("set-not-decided"));
    player.points("a", 1);
    expect(player.try(confirmSetEnd)).toStrictEqual(refusal("set-not-decided"));
    player.points("b", 1);
    player.points("a", 2);
    const finalEvents = player.run(confirmSetEnd);

    expect(finalEvents.map(({ type }) => type)).toStrictEqual(["SetEnded", "MatchEnded"]);
    const state = player.state();
    expect(state.currentMatch).toBeNull();
    const [match] = state.finishedMatches;
    expect(match?.winner).toBe("a");
    expect(match?.setsWon).toStrictEqual({ a: 2, b: 1 });
    expect(match?.completedSets.map(({ score }) => score)).toStrictEqual([
      { a: 25, b: 20 },
      { a: 23, b: 25 },
      { a: 17, b: 15 },
    ]);
    expect(match?.completedSets.map(({ winner }) => winner)).toStrictEqual(["a", "b", "a"]);
  });

  test("everything after the end is refused", () => {
    const player = new Player(MD3_REAL);
    player.playSet("a", 25, 0);
    player.playSet("a", 25, 0);
    const commands: readonly Command[] = [
      (state) => scorePoint(state, "a"),
      confirmSetEnd,
      (state) => endMatchManually(state, "a"),
    ];
    commands.forEach((command) => {
      expect(player.try(command)).toStrictEqual(refusal("no-open-match"));
    });
  });
});

describe("a real best-of-5 with tie-break, played by commands to the end", () => {
  test("alternating winners reach the 5th set, which plays to 15", () => {
    const player = new Player(MD5_REAL);
    player.playSet("a", 25, 10);
    player.playSet("b", 25, 10);
    player.playSet("a", 26, 24);
    player.playSet("b", 30, 28);
    expect(player.state().currentMatch?.setsWon).toStrictEqual({ a: 2, b: 2 });
    expect(player.state().currentMatch?.currentSet).toStrictEqual({
      firstServer: "a",
      score: { a: 0, b: 0 },
      servingTeam: "a",
      setNumber: 5,
      targetPoints: 15,
    });

    player.points("b", 14);
    expect(player.try(confirmSetEnd).ok).toBe(false);
    player.points("a", 13);
    player.points("b", 1);
    expect(player.try((state) => scorePoint(state, "a")).ok).toBe(false);
    player.run(confirmSetEnd);

    const [match] = player.state().finishedMatches;
    expect(match?.winner).toBe("b");
    expect(match?.setsWon).toStrictEqual({ a: 2, b: 3 });
    expect(match?.completedSets).toHaveLength(5);
    expect(match?.endReason).toBe("sets-won");
  });

  test("3-0 never opens a 4th set", () => {
    const player = new Player(MD5_REAL);
    player.playSet("a", 25, 0);
    player.playSet("a", 25, 0);
    player.playSet("a", 25, 0);
    const [match] = player.state().finishedMatches;
    expect(match?.completedSets).toHaveLength(3);
    expect(player.state().currentMatch).toBeNull();
  });
});

describe("every legal format combination, played by commands", () => {
  const BEST_OF = [1, 3, 5] as const;
  const MARGINS = [1, 2] as const;
  const TIE_BREAKS = [null, 1, 2, 15] as const;
  const POINTS = [1, 2, 25] as const;
  const combos: readonly ScoringRules[] = BEST_OF.flatMap((bestOf) =>
    MARGINS.flatMap((winMargin) =>
      TIE_BREAKS.flatMap((tieBreakPoints) =>
        POINTS.map((pointsPerSet) => ({ bestOf, pointsPerSet, tieBreakPoints, winMargin })),
      ),
    ),
  );

  test.each(combos)("%o ends by sets won and uses the right targets", (scoring) => {
    const player = new Player(scoring);
    const targets: number[] = [];
    for (let setNumber = 1; ; setNumber += 1) {
      const set = player.state().currentMatch?.currentSet;
      if (set === undefined || set === null) {
        break;
      }
      targets.push(set.targetPoints);
      const winner: TeamSide = setNumber % 2 === 1 ? "a" : "b";
      const loserPoints = Math.max(0, set.targetPoints - scoring.winMargin);
      const winnerPoints = Math.max(set.targetPoints, loserPoints + scoring.winMargin);
      player.playSet(winner, winnerPoints, loserPoints);
    }
    const [match] = player.state().finishedMatches;
    expect(player.state().currentMatch).toBeNull();
    expect(match?.completedSets).toHaveLength(scoring.bestOf);
    expect(Math.max(match?.setsWon.a ?? 0, match?.setsWon.b ?? 0)).toBe(
      Math.ceil(scoring.bestOf / 2),
    );
    const expectedTargets = Array.from({ length: scoring.bestOf }, (_unused, index) =>
      scoring.bestOf > 1 && index + 1 === scoring.bestOf && scoring.tieBreakPoints !== null
        ? scoring.tieBreakPoints
        : scoring.pointsPerSet,
    );
    expect(targets).toStrictEqual(expectedTargets);
  });
});

describe("limits of scorePoint and confirmSetEnd", () => {
  test("without advantage, 24-24 is open and the next point decides", () => {
    const player = new Player({ bestOf: 1, pointsPerSet: 25, tieBreakPoints: null, winMargin: 1 });
    player.points("a", 24);
    expect(player.try(confirmSetEnd).ok).toBe(false);
    player.points("b", 24);
    expect(player.try(confirmSetEnd).ok).toBe(false);
    player.points("a", 1);
    expect(player.try((state) => scorePoint(state, "b")).ok).toBe(false);
    expect(player.try(confirmSetEnd).ok).toBe(true);
  });

  test("with margin 2, 25-24 and 26-25 do not end; 27-25 does", () => {
    const player = new Player({ bestOf: 1, pointsPerSet: 25, tieBreakPoints: null, winMargin: 2 });
    player.points("b", 24);
    player.points("a", 25);
    expect(player.try(confirmSetEnd).ok).toBe(false);
    player.points("b", 1);
    player.points("a", 1);
    expect(player.try(confirmSetEnd).ok).toBe(false);
    player.points("a", 1);
    expect(player.try((state) => scorePoint(state, "a")).ok).toBe(false);
    expect(player.try(confirmSetEnd).ok).toBe(true);
  });

  test("a long deuce is decided exactly at a margin of 2", () => {
    const player = new Player({ bestOf: 1, pointsPerSet: 1, tieBreakPoints: null, winMargin: 2 });
    for (let round = 0; round < 100; round += 1) {
      player.points("a", 1);
      player.points("b", 1);
    }
    expect(player.try(confirmSetEnd).ok).toBe(false);
    player.points("b", 2);
    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 100, b: 102 });
    expect(player.run(confirmSetEnd).map(({ type }) => type)).toStrictEqual([
      "SetEnded",
      "MatchEnded",
    ]);
  });

  test("confirmSetEnd twice in a row: the second is refused, not duplicated", () => {
    const player = new Player(MD3_REAL);
    player.points("a", 25);
    player.run(confirmSetEnd);
    expect(player.try(confirmSetEnd)).toStrictEqual(refusal("set-not-decided"));
    expect(player.state().currentMatch?.completedSets).toHaveLength(1);
  });

  test("commands do not mutate the state they receive", () => {
    const player = new Player(MD3_REAL);
    player.points("a", 3);
    const state = player.state();
    const snapshot = JSON.stringify(state);
    scorePoint(state, "a");
    confirmSetEnd(state);
    endMatchManually(state, "b");
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("undo around the end of a match", () => {
  const ONE_SET: ScoringRules = { bestOf: 1, pointsPerSet: 2, tieBreakPoints: null, winMargin: 2 };
  const LAST_POINT = 2;
  const FIRST_POINT = 1;
  const SET_ENDED = 3;
  const MATCH_ENDED = 4;

  function decidedMatch() {
    const player = new Player(ONE_SET);
    player.points("a", 2);
    player.run(confirmSetEnd);
    return player;
  }

  test("the fixture has the five events the tests below index", () => {
    expect(decidedMatch().events.map(({ type }) => type)).toStrictEqual([
      "MatchStarted",
      "PointScored",
      "PointScored",
      "SetEnded",
      "MatchEnded",
    ]);
  });

  test("reverting to the SetEnded drops MatchEnded; the command finishes the match again", () => {
    const player = decidedMatch();
    player.revertTo(SET_ENDED);
    const state = player.state();
    expect(state.finishedMatches).toHaveLength(0);
    expect(state.currentMatch?.currentSet).toBeNull();
    expect(state.currentMatch?.setsWon).toStrictEqual({ a: 1, b: 0 });
    expect(player.run(confirmSetEnd).map(({ type }) => type)).toStrictEqual(["MatchEnded"]);
    expect(player.state().finishedMatches).toHaveLength(1);
  });

  test("reverting to the last point reopens the set; scoring then goes on normally", () => {
    const player = decidedMatch();
    player.revertTo(LAST_POINT);
    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 2, b: 0 });
    expect(player.try((state) => scorePoint(state, "b"))).toStrictEqual(refusal("set-decided"));
    player.revertTo(FIRST_POINT);
    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 1, b: 0 });
    player.points("b", 1);
    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 1, b: 1 });
    expect(player.try(confirmSetEnd)).toStrictEqual(refusal("set-not-decided"));
  });

  test("reverting to MatchEnded itself changes nothing", () => {
    const player = decidedMatch();
    const before = player.state();
    player.revertTo(MATCH_ENDED);
    expect(player.state()).toStrictEqual(before);
    expect(player.try((state) => scorePoint(state, "a"))).toStrictEqual(refusal("no-open-match"));
  });

  test("a finished match id cannot be reused by startMatch", () => {
    const player = decidedMatch();
    expect(startMatch(player.state(), matchInput(MD3_REAL, MATCH_ID)).ok).toBe(false);
  });
});
