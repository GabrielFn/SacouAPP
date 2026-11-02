import { err } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "../event-log/volume-test-timeout.test.fixture.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import {
  COURT_SESSION_ID,
  MATCH_ID,
  matchInput,
  numberedMatchId,
  replayAll,
  rotationMatchInput,
  toEnvelope,
} from "./match-player.test.fixture.js";
import {
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_FINISHED_MATCHES,
  POINT_SCORED_EVENT_TYPE,
} from "./constants.data.js";
import type {
  CourtSessionState,
  ScoreCommandResult,
  ScoreEventType,
  ScoringRules,
} from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 2 };
const TEN_THOUSAND = 10_000;
/** 20 thousand matches, 40 thousand events: enough to exhaust the heap without the match limit. */
const HOSTILE_MATCHES = 20_000;
const EVENTS_PER_MATCH = 2;
const REPLAY_CONFIG = {
  courtSessionId: COURT_SESSION_ID,
  initialState: INITIAL_COURT_SESSION_STATE,
  appliers: SCORE_APPLIERS,
};

function matchStartedAt(sequence: number, matchNumber: number): EventEnvelope {
  const payload = matchInput(MD3, numberedMatchId(matchNumber));
  return toEnvelope({ type: MATCH_STARTED_EVENT_TYPE, payload }, sequence);
}

function matchEndedAt(sequence: number, matchNumber: number): EventEnvelope {
  const payload = {
    endReason: "manual" as const,
    matchId: numberedMatchId(matchNumber),
    winner: null,
  };
  return toEnvelope({ type: MATCH_ENDED_EVENT_TYPE, payload }, sequence);
}

function shortMatches(count: number): readonly EventEnvelope[] {
  return Array.from({ length: count }, (_, index) => [
    matchStartedAt(EVENTS_PER_MATCH * index + 1, index + 1),
    matchEndedAt(EVENTS_PER_MATCH * index + EVENTS_PER_MATCH, index + 1),
  ]).flat();
}

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

  test(
    "replays 10 thousand points without overflowing",
    () => {
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
    },
    VOLUME_TEST_TIMEOUT_MS,
  );
});

describe("appliers with rotation", () => {
  const LONG_SET: ScoringRules = {
    bestOf: 1,
    pointsPerSet: 99,
    tieBreakPoints: null,
    winMargin: 2,
  };
  const ONE_THOUSAND = 1000;
  /** Alternating rallies: 500 to 5000 per team adds one digit to each side of the score. */
  const SCORE_DIGITS_ADDED = 2;
  const TEAM_MAX = 24;

  function alternatingLog(pointCount: number): readonly EventEnvelope[] {
    const start = {
      type: MATCH_STARTED_EVENT_TYPE as ScoreEventType,
      payload: rotationMatchInput(LONG_SET),
    };
    const points = Array.from({ length: pointCount }, (_, index) =>
      toEnvelope(
        {
          type: POINT_SCORED_EVENT_TYPE,
          payload: {
            matchId: MATCH_ID,
            setNumber: 1,
            team: index % EVENTS_PER_MATCH === 0 ? "b" : "a",
          },
        },
        index + 2,
      ),
    );
    return [toEnvelope(start, 1), ...points];
  }

  test("never mutate a state frozen in depth, and it survives a JSON round trip", () => {
    const steps: readonly ((state: CourtSessionState) => ScoreCommandResult)[] = [
      (state) => startMatch(state, rotationMatchInput(MD3, { zones: [2, 5] })),
      (state) => scorePoint(state, "b"),
      (state) => scorePoint(state, "a"),
      (state) => scorePoint(state, "a"),
      (state) => scorePoint(state, "a"),
      confirmSetEnd,
      (state) => scorePoint(state, "a"),
      (state) => endMatchManually(state, null),
    ];

    const final = steps.reduce((state, step) => {
      const next = applyFrozen(state, step(state));
      expect(JSON.parse(JSON.stringify(next))).toStrictEqual(next);
      return next;
    }, INITIAL_COURT_SESSION_STATE);

    // b4 and a1 in set 1; set 2 was first served by b, so the point of a is a side-out to a6.
    expect(final.finishedMatches[0]?.rotations.a?.setterZone).toBe(6);
    expect(final.finishedMatches[0]?.rotations.b?.setterZone).toBe(4);
  });

  test(
    "replays 10 thousand side-outs without overflowing",
    () => {
      const state = replayAll(alternatingLog(TEN_THOUSAND));

      // 5000 rotations per team: 5000 mod 6 is 2, two steps from zone 1 down the sequence.
      expect(state.currentMatch?.currentSet?.score).toStrictEqual({ a: 5000, b: 5000 });
      expect(state.currentMatch?.currentSet?.servingTeam).toBe("a");
      expect(state.currentMatch?.rotations.a?.setterZone).toBe(5);
      expect(state.currentMatch?.rotations.b?.setterZone).toBe(5);
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test(
    "the size of the state does not depend on the number of rallies",
    () => {
      const small = JSON.stringify(replayAll(alternatingLog(ONE_THOUSAND)));
      const large = JSON.stringify(replayAll(alternatingLog(TEN_THOUSAND)));

      expect(large.length - small.length).toBe(SCORE_DIGITS_ADDED);
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test(
    "200 finished matches with full teams and rotations are accepted, and the 201st is rejected",
    () => {
      const started = (sequence: number, matchNumber: number) =>
        toEnvelope(
          {
            type: MATCH_STARTED_EVENT_TYPE,
            payload: rotationMatchInput(MD3, {
              matchId: numberedMatchId(matchNumber),
              teamSize: TEAM_MAX,
            }),
          },
          sequence,
        );
      const finished = Array.from({ length: MAX_FINISHED_MATCHES }, (_, index) => [
        started(EVENTS_PER_MATCH * index + 1, index + 1),
        matchEndedAt(EVENTS_PER_MATCH * index + EVENTS_PER_MATCH, index + 1),
      ]).flat();
      const nextMatch = MAX_FINISHED_MATCHES + 1;
      const over = started(finished.length + 1, nextMatch);

      expect(replayAll(finished).finishedMatches).toHaveLength(MAX_FINISHED_MATCHES);
      expect(replayEvents(REPLAY_CONFIG, [...finished, over])).toStrictEqual(
        err({ code: "event-rejected", eventId: over.eventId }),
      );
    },
    VOLUME_TEST_TIMEOUT_MS,
  );
});

describe("cost of a hostile log", () => {
  test(
    "a log with far more matches stops at the limit, before the state grows",
    () => {
      const log = shortMatches(HOSTILE_MATCHES);

      const replayed = replayEvents(REPLAY_CONFIG, log);

      const firstOverLimit = log[EVENTS_PER_MATCH * MAX_FINISHED_MATCHES];
      expect(replayed).toStrictEqual(
        err({ code: "event-rejected", eventId: firstOverLimit?.eventId }),
      );
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test(
    "reverting over and over at the limit does not get past it",
    () => {
      const finished = shortMatches(MAX_FINISHED_MATCHES - 1);
      const lastStart = matchStartedAt(finished.length + 1, MAX_FINISHED_MATCHES);
      const churn = Array.from({ length: HOSTILE_MATCHES }, (_, index) => {
        const sequence = lastStart.sequence + EVENTS_PER_MATCH * index + 1;
        const ended = matchEndedAt(sequence, MAX_FINISHED_MATCHES);
        const revert: EventEnvelope = {
          ...matchEndedAt(sequence + 1, MAX_FINISHED_MATCHES),
          payload: { targetEventId: lastStart.eventId },
          type: REVERTED_TO_EVENT_TYPE,
        };
        return [ended, revert];
      }).flat();

      const replayed = replayEvents(REPLAY_CONFIG, [...finished, lastStart, ...churn]);

      expect(replayed.ok && replayed.value.state.finishedMatches).toHaveLength(
        MAX_FINISHED_MATCHES - 1,
      );
      expect(replayed.ok && replayed.value.state.currentMatch?.matchId).toBe(
        numberedMatchId(MAX_FINISHED_MATCHES),
      );
    },
    VOLUME_TEST_TIMEOUT_MS,
  );
});
