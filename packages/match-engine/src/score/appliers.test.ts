import { describe, expect, test } from "vitest";

import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import { matchInput, replayAll, toEnvelope } from "./match-player.test.fixture.js";
import { POINT_SCORED_EVENT_TYPE } from "./constants.data.js";
import type {
  CourtSessionState,
  ScoreCommandResult,
  ScoreEventType,
  ScoringRules,
} from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 2 };
const TEN_THOUSAND = 10_000;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Applies directly, with no replay in the way: a mutation of frozen state would throw here. */
function applyFrozen(state: CourtSessionState, result: ScoreCommandResult): CourtSessionState {
  if (!result.ok) {
    throw new Error(`command refused: ${result.error.code}`);
  }
  return result.value.reduce((current, draft, index) => {
    const applier = SCORE_APPLIERS.get(draft.type);
    if (applier === undefined) {
      throw new Error(`no applier for ${draft.type}`);
    }
    const applied = applier(deepFreeze(current), toEnvelope(draft, index + 1));
    if (!applied.ok) {
      throw new Error(`rejected: ${draft.type}`);
    }
    return applied.value;
  }, state);
}

describe("appliers", () => {
  test("never mutate a state frozen in depth, and it survives a JSON round trip", () => {
    const steps: readonly ((state: CourtSessionState) => ScoreCommandResult)[] = [
      (state) => startMatch(state, matchInput(MD3)),
      (state) => scorePoint(state, "a"),
      (state) => scorePoint(state, "a"),
      confirmSetEnd,
      (state) => scorePoint(state, "b"),
      (state) => endMatchManually(state, "b"),
    ];

    const final = steps.reduce((state, step) => {
      const next = applyFrozen(state, step(state));
      expect(JSON.parse(JSON.stringify(next))).toStrictEqual(next);
      return next;
    }, INITIAL_COURT_SESSION_STATE);

    expect(final.currentMatch).toBeNull();
    expect(final.finishedMatches[0]?.currentSet?.score).toStrictEqual({ a: 0, b: 1 });
    expect(final.finishedMatches[0]?.setsWon).toStrictEqual({ a: 1, b: 0 });
  });

  test("the initial state is not changed by a match", () => {
    applyFrozen(
      INITIAL_COURT_SESSION_STATE,
      startMatch(INITIAL_COURT_SESSION_STATE, matchInput(MD3)),
    );

    expect(INITIAL_COURT_SESSION_STATE).toStrictEqual({ currentMatch: null, finishedMatches: [] });
  });

  test("the frozen copy is read from the event, not from a shared reference", () => {
    const input = matchInput(MD3);
    const state = applyFrozen(
      INITIAL_COURT_SESSION_STATE,
      startMatch(INITIAL_COURT_SESSION_STATE, input),
    );

    expect(state.currentMatch?.teams).not.toBe(input.teams);
    expect(state.currentMatch?.teams).toStrictEqual(input.teams);
  });

  test("replays 10 thousand points without overflowing", () => {
    const start = startMatch(INITIAL_COURT_SESSION_STATE, matchInput(MD3));
    if (!start.ok) {
      throw new Error("start refused");
    }
    const matchStarted = start.value[0];
    if (matchStarted === undefined) {
      throw new Error("no event");
    }
    const point = {
      type: POINT_SCORED_EVENT_TYPE as ScoreEventType,
      payload: { matchId: matchInput(MD3).matchId, setNumber: 1, team: "a" as const },
    };
    const events = [
      toEnvelope(matchStarted, 1),
      ...Array.from({ length: TEN_THOUSAND }, (_, index) => toEnvelope(point, index + 2)),
    ];

    const state = replayAll(events);

    expect(state.currentMatch?.currentSet?.score).toStrictEqual({ a: TEN_THOUSAND, b: 0 });
  });
});
