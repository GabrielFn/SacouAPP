import { FORMATION_CATALOG, type SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import { SETTER_ZONE_SEQUENCE } from "./constants.data.js";
import {
  BLUE_LINEUP,
  EMPTY_QUEUE,
  MATCH_ID,
  ORANGE_LINEUP,
  rotationMatchInput,
  toEnvelope,
} from "./match-player.test.fixture.js";
import {
  getCurrentServingPlayer,
  getLineupBySlot,
  getServingPlayer,
  nextSetterZone,
  previousSetterZone,
} from "./rotation-rules.js";
import type {
  CourtSessionState,
  MatchScore,
  ScoreCommandResult,
  ScoringRules,
  TeamSide,
} from "./types.js";

const LONG_SET: ScoringRules = { bestOf: 1, pointsPerSet: 99, tieBreakPoints: null, winMargin: 2 };
const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 2 };
const RALLIES = 8;
const SIDES = ["a", "b"] as const;
const BINARY = 2;

/** An oracle apart from the engine: the zones in the order of the official rotation rule. */
const NEXT_ZONE: Readonly<Record<SetterZone, SetterZone>> = {
  1: 6,
  6: 5,
  5: 4,
  4: 3,
  3: 2,
  2: 1,
};

function apply(state: CourtSessionState, result: ScoreCommandResult): CourtSessionState {
  if (!result.ok) {
    throw new Error(`refused: ${result.error.code}`);
  }
  return result.value.reduce((current, draft, index) => {
    const applied = SCORE_APPLIERS.get(draft.type)?.(current, toEnvelope(draft, index + 1));
    if (applied === undefined || !applied.ok) {
      throw new Error(`rejected: ${draft.type}`);
    }
    return applied.value;
  }, state);
}

function point(team: TeamSide): (state: CourtSessionState) => CourtSessionState {
  return (state) => {
    const applied = SCORE_APPLIERS.get("PointScored")?.(
      state,
      toEnvelope({ type: "PointScored", payload: { matchId: MATCH_ID, setNumber: 1, team } }, 1),
    );
    if (applied === undefined || !applied.ok) {
      throw new Error("rejected");
    }
    return applied.value;
  };
}

function current(state: CourtSessionState): MatchScore {
  if (state.currentMatch === null) {
    throw new Error("no open match");
  }
  return state.currentMatch;
}

function zoneOf(match: MatchScore, team: TeamSide): SetterZone {
  const teamState = match.rotations[team];
  if (teamState === null) {
    throw new Error("rotation off");
  }
  return teamState.setterZone;
}

function servingTeam(match: MatchScore): TeamSide {
  if (match.currentSet === null) {
    throw new Error("no open set");
  }
  return match.currentSet.servingTeam;
}

function allSequences(length: number): readonly (readonly TeamSide[])[] {
  return Array.from({ length: BINARY ** length }, (_, bits) =>
    Array.from({ length }, (_unused, index) =>
      Math.floor(bits / BINARY ** index) % BINARY === 0 ? "a" : "b",
    ),
  );
}

describe("the sequence of zones", () => {
  test("is the rotation order of the 5x1 in the formations catalog", () => {
    expect(FORMATION_CATALOG.systems["5x1"].rotationOrder).toStrictEqual([...SETTER_ZONE_SEQUENCE]);
  });
});

describe("every sequence of rallies", () => {
  test.each(SIDES)("with %s serving first follows the rule at every step", (firstServer) => {
    const initial = apply(
      INITIAL_COURT_SESSION_STATE,
      startMatch(INITIAL_COURT_SESSION_STATE, rotationMatchInput(LONG_SET, { firstServer })),
    );

    allSequences(RALLIES).forEach((rallies) => {
      rallies.reduce((state, winner) => {
        const before = current(state);
        const after = current(point(winner)(state));
        const loser: TeamSide = winner === "a" ? "b" : "a";
        const wonServing = servingTeam(before) === winner;
        const expectedZone = wonServing
          ? zoneOf(before, winner)
          : NEXT_ZONE[zoneOf(before, winner)];

        expect(servingTeam(after)).toBe(winner);
        expect(zoneOf(after, winner)).toBe(expectedZone);
        expect(zoneOf(after, loser)).toBe(zoneOf(before, loser));
        return { currentMatch: after, finishedMatches: [], queue: EMPTY_QUEUE };
      }, initial);
    });
  });
});

describe("the lineup of the screens", () => {
  test("in zone 2 has João serving and Pedro in slot 2, as in screens 09 and 22", () => {
    const [pedro, ana, lia, marcos, bia, joao] = ORANGE_LINEUP;

    expect(getLineupBySlot(ORANGE_LINEUP, 2)).toStrictEqual([joao, pedro, ana, lia, marcos, bia]);
    expect(getServingPlayer(ORANGE_LINEUP, 2)).toBe(joao);
  });

  test("in zone 3 has Duda serving, as before screen 24", () => {
    expect(getServingPlayer(BLUE_LINEUP, 3)).toBe(BLUE_LINEUP[4]);
  });

  test("does not change the array it reads", () => {
    const lineup = [...ORANGE_LINEUP];

    getLineupBySlot(lineup, 4);

    expect(lineup).toStrictEqual(ORANGE_LINEUP);
  });
});

describe("getCurrentServingPlayer", () => {
  function started(setup: Parameters<typeof rotationMatchInput>[1]): CourtSessionState {
    return apply(
      INITIAL_COURT_SESSION_STATE,
      startMatch(INITIAL_COURT_SESSION_STATE, rotationMatchInput(MD3, setup)),
    );
  }

  test("follows the server after each side-out", () => {
    const start = started({ zones: [2, 5] });
    const afterSideOut = point("b")(start);
    const afterSideOutBack = point("a")(afterSideOut);

    // Zone 2 of the orange team has the sixth of the lineup serving.
    expect(getCurrentServingPlayer(current(start))).toBe(ORANGE_LINEUP[5]);
    // Blue goes from 5 to 4: three rotations from zone 1 bring the fourth of the lineup to slot 1.
    expect(getCurrentServingPlayer(current(afterSideOut))).toBe(BLUE_LINEUP[3]);
    // Orange goes from 2 to 1: the setter serves.
    expect(getCurrentServingPlayer(current(afterSideOutBack))).toBe(ORANGE_LINEUP[0]);
  });

  test("is null when the team that serves has its rotation off", () => {
    const start = started({ zones: [null, 1] });

    expect(getCurrentServingPlayer(current(start))).toBeNull();
    expect(getCurrentServingPlayer(current(point("b")(start)))).toBe(BLUE_LINEUP[1]);
  });

  test("is null without an open set", () => {
    const start = started({});
    const ended = apply(start, endMatchManually(start, null));
    const [finished] = ended.finishedMatches;
    if (finished === undefined) {
      throw new Error("no finished match");
    }
    const withoutSet = { ...finished, currentSet: null };

    expect(getCurrentServingPlayer(withoutSet)).toBeNull();
  });

  test("the deciding SetEnded leaves no server", () => {
    const single: ScoringRules = { ...MD3, bestOf: 1 };
    const start = apply(
      INITIAL_COURT_SESSION_STATE,
      startMatch(INITIAL_COURT_SESSION_STATE, rotationMatchInput(single)),
    );
    const decided = [point("a"), point("a")].reduce((state, step) => step(state), start);
    const result = confirmSetEnd(decided);
    const onlySetEnded = result.ok ? { ...result, value: result.value.slice(0, 1) } : result;

    const pending = apply(decided, onlySetEnded);

    expect(getCurrentServingPlayer(current(pending))).toBeNull();
    expect(scorePoint(pending, "a").ok).toBe(false);
  });
});

describe("previousSetterZone", () => {
  test("is the zone before in the sequence, and zone 1 comes back from zone 2", () => {
    SETTER_ZONE_SEQUENCE.forEach((zone, index) => {
      const before =
        SETTER_ZONE_SEQUENCE[index - 1] ?? SETTER_ZONE_SEQUENCE[SETTER_ZONE_SEQUENCE.length - 1];
      expect(previousSetterZone(zone)).toBe(before);
    });
  });

  test("undoes one rotation from every zone, and never leaves the zones 1 to 6", () => {
    SETTER_ZONE_SEQUENCE.forEach((zone) => {
      expect(previousSetterZone(nextSetterZone(zone))).toBe(zone);
      expect(nextSetterZone(previousSetterZone(zone))).toBe(zone);
      expect(SETTER_ZONE_SEQUENCE).toContain(previousSetterZone(zone));
    });
  });

  test("is not the table of the forward rotation", () => {
    expect(SETTER_ZONE_SEQUENCE.map(previousSetterZone)).toStrictEqual([2, 1, 6, 5, 4, 3]);
  });
});
