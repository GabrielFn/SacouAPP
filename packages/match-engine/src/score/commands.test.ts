import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { EventEnvelope } from "../event-log/types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "../event-log/volume-test-timeout.test.fixture.js";
import { INITIAL_COURT_SESSION_STATE } from "./appliers.js";
import { confirmSetEnd, endMatchManually, scorePoint, startMatch } from "./commands.js";
import { CURRENT_RULES_VERSION, MAX_FINISHED_MATCHES } from "./constants.data.js";
import {
  MATCH_ID,
  matchInput,
  numberedMatchId,
  replayAll,
  toEnvelope,
} from "./match-player.test.fixture.js";
import type {
  CourtSessionState,
  MatchStartedPayload,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoringRules,
  TeamSide,
} from "./types.js";

const MD1: ScoringRules = { bestOf: 1, pointsPerSet: 2, tieBreakPoints: null, winMargin: 2 };
const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 2 };
const NO_ADVANTAGE: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 1, winMargin: 1 };

interface MatchPlayer {
  readonly state: () => CourtSessionState;
  readonly run: (
    command: (state: CourtSessionState) => ScoreCommandResult,
  ) => readonly ScoreEventDraft[];
}

/** Plays commands through envelopes, parser and replay, proving the replay accepts their events. */
function createMatchPlayer(): MatchPlayer {
  const events: EventEnvelope[] = [];
  const state = () => replayAll(events);
  return {
    state,
    run: (command) => {
      const result = command(state());
      if (!result.ok) {
        throw new Error(`command refused: ${result.error.code}`);
      }
      result.value.forEach((draft) => {
        events.push(toEnvelope(draft, events.length + 1));
      });
      return result.value;
    },
  };
}

function started(scoring: ScoringRules): MatchPlayer {
  const player = createMatchPlayer();
  player.run((state) => startMatch(state, matchInput(scoring)));
  return player;
}

function score(player: MatchPlayer, teams: string) {
  teams.split("").forEach((team) => {
    player.run((state) => scorePoint(state, team as TeamSide));
  });
}

function errorCode(result: ScoreCommandResult) {
  return result.ok ? null : result.error.code;
}

function eventTypes(result: ScoreCommandResult) {
  return result.ok ? result.value.map(({ type }) => type) : [];
}

describe("startMatch", () => {
  test("emits a MatchStarted with the validated input", () => {
    const input = matchInput(MD3);
    const result = startMatch(INITIAL_COURT_SESSION_STATE, input);

    expect(result).toStrictEqual({ ok: true, value: [{ type: "MatchStarted", payload: input }] });
  });

  test("refuses when a match is already open", () => {
    const player = started(MD3);
    const other = matchInput(MD3, "f0000000-0000-4000-8000-000000000002");

    expect(errorCode(startMatch(player.state(), other))).toBe("match-already-open");
  });

  test("refuses a rules version it does not support, though the replay would accept it", () => {
    const input: MatchStartedPayload = {
      ...matchInput(MD3),
      rulesVersion: CURRENT_RULES_VERSION + 1,
    };

    expect(errorCode(startMatch(INITIAL_COURT_SESSION_STATE, input))).toBe(
      "unsupported-rules-version",
    );
  });

  test("validates the input with the payload parser", () => {
    const input = { ...matchInput(MD3), matchId: "Gabriel" };

    expect(startMatch(INITIAL_COURT_SESSION_STATE, input)).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "matchId" },
    });
  });

  test("refuses the id of a finished match, which the replay would reject", () => {
    const player = started(MD1);
    player.run((state) => endMatchManually(state, null));

    expect(startMatch(player.state(), matchInput(MD1))).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "matchId" },
    });
  });

  test(
    "goes up to the limit of finished matches through the replay, then refuses",
    () => {
      const player = createMatchPlayer();
      Array.from({ length: MAX_FINISHED_MATCHES }, (_, index) => index + 1).forEach((number) => {
        player.run((state) => startMatch(state, matchInput(MD1, numberedMatchId(number))));
        player.run((state) => endMatchManually(state, null));
      });
      const next = matchInput(MD1, numberedMatchId(MAX_FINISHED_MATCHES + 1));

      expect(player.state().finishedMatches).toHaveLength(MAX_FINISHED_MATCHES);
      expect(errorCode(startMatch(player.state(), next))).toBe("too-many-matches");
    },
    VOLUME_TEST_TIMEOUT_MS,
  );
});

describe("scorePoint", () => {
  test("refuses without an open match", () => {
    expect(errorCode(scorePoint(INITIAL_COURT_SESSION_STATE, "a"))).toBe("no-open-match");
  });

  test("records the team and the set, never an absolute score", () => {
    const player = started(MD3);

    expect(scorePoint(player.state(), "b")).toStrictEqual({
      ok: true,
      value: [{ type: "PointScored", payload: { matchId: MATCH_ID, setNumber: 1, team: "b" } }],
    });
  });

  test("refuses once the set is decided and not confirmed", () => {
    const player = started(MD3);
    score(player, "aa");

    expect(errorCode(scorePoint(player.state(), "b"))).toBe("set-decided");
  });

  test("keeps scoring through advantage until the margin is reached", () => {
    const player = started(MD3);
    score(player, "ababa");

    expect(errorCode(scorePoint(player.state(), "b"))).toBeNull();
    score(player, "a");
    expect(errorCode(scorePoint(player.state(), "b"))).toBe("set-decided");
  });

  test("without advantage, one point past the target decides", () => {
    const player = started(NO_ADVANTAGE);
    score(player, "aba");

    expect(errorCode(scorePoint(player.state(), "a"))).toBe("set-decided");
  });

  test("refuses with no open set, after a deciding SetEnded stored alone", () => {
    const player = started(MD1);
    score(player, "aa");
    const [setEnded] = player.run((state) => {
      const result = confirmSetEnd(state);
      return result.ok ? { ok: true, value: result.value.slice(0, 1) } : result;
    });

    expect(setEnded?.type).toBe("SetEnded");
    expect(errorCode(scorePoint(player.state(), "a"))).toBe("no-open-set");
  });
});

describe("confirmSetEnd", () => {
  test("refuses without an open match", () => {
    expect(errorCode(confirmSetEnd(INITIAL_COURT_SESSION_STATE))).toBe("no-open-match");
  });

  test("refuses an undecided set", () => {
    const player = started(MD3);
    score(player, "a");

    expect(errorCode(confirmSetEnd(player.state()))).toBe("set-not-decided");
  });

  test("emits only SetEnded with the next target in the first set of a series", () => {
    const player = started(MD3);
    score(player, "aa");

    expect(confirmSetEnd(player.state())).toStrictEqual({
      ok: true,
      value: [
        {
          type: "SetEnded",
          payload: {
            matchId: MATCH_ID,
            nextSet: { targetPoints: 2 },
            setNumber: 1,
            winner: "a",
          },
        },
      ],
    });
  });

  test("announces the tie-break target when the deciding set is next", () => {
    const player = started(MD3);
    score(player, "aa");
    player.run(confirmSetEnd);
    score(player, "bb");

    const result = confirmSetEnd(player.state());

    expect(result.ok && result.value[0]?.payload).toMatchObject({
      nextSet: { targetPoints: 1 },
      setNumber: 2,
      winner: "b",
    });
  });

  test("emits two events when the set decides the match", () => {
    const player = started(MD3);
    score(player, "aa");
    player.run(confirmSetEnd);
    score(player, "aa");

    const result = confirmSetEnd(player.state());

    expect(eventTypes(result)).toStrictEqual(["SetEnded", "MatchEnded"]);
    expect(result.ok && result.value[0]?.payload).toMatchObject({ nextSet: null });
    expect(result.ok && result.value[1]?.payload).toStrictEqual({
      endReason: "sets-won",
      matchId: MATCH_ID,
      winner: "a",
    });
  });

  test("emits only the missing MatchEnded after a partial write", () => {
    const player = started(MD1);
    score(player, "aa");
    player.run((state) => {
      const result = confirmSetEnd(state);
      return result.ok ? { ok: true, value: result.value.slice(0, 1) } : result;
    });

    const result = confirmSetEnd(player.state());

    expect(eventTypes(result)).toStrictEqual(["MatchEnded"]);
  });

  test("refuses with no open set and no decided match", () => {
    const state: CourtSessionState = {
      currentMatch: {
        completedSets: [],
        currentSet: null,
        matchId: MATCH_ID,
        rulesVersion: 1,
        scoring: MD3,
        setsWon: { a: 0, b: 0 },
        teams: matchInput(MD3).teams,
      },
      finishedMatches: [],
    };

    expect(errorCode(confirmSetEnd(state))).toBe("no-open-set");
  });
});

describe("endMatchManually", () => {
  test("refuses without an open match", () => {
    expect(errorCode(endMatchManually(INITIAL_COURT_SESSION_STATE, "a"))).toBe("no-open-match");
  });

  test.each(["a", "b", null] as const)("records %s as the winner", (winner) => {
    const player = started(MD3);

    expect(endMatchManually(player.state(), winner)).toStrictEqual({
      ok: true,
      value: [{ type: "MatchEnded", payload: { endReason: "manual", matchId: MATCH_ID, winner } }],
    });
  });
});

describe("whole matches by commands", () => {
  interface GoldenEvent {
    readonly type: string;
    readonly payload: { readonly team?: TeamSide };
  }

  interface GoldenCase {
    readonly id: string;
    readonly events: readonly GoldenEvent[];
    readonly expected: { readonly state: CourtSessionState };
  }

  const GOLDEN_URL = new URL("../../golden/score-events.json", import.meta.url);
  const GOLDEN_CASES = JSON.parse(readFileSync(GOLDEN_URL, "utf8")) as readonly GoldenCase[];

  function playByCommands({ events }: GoldenCase, player: MatchPlayer) {
    events.forEach(({ type, payload }) => {
      if (type === "MatchStarted") {
        player.run((state) => startMatch(state, payload as unknown as MatchStartedPayload));
      } else if (type === "PointScored") {
        player.run((state) => scorePoint(state, payload.team as TeamSide));
      } else if (type === "SetEnded") {
        player.run(confirmSetEnd);
      }
    });
  }

  test.each([
    "g1-one-set-25-23-ends-the-match",
    "g2-best-of-3-ends-in-two-sets",
    "g3-best-of-3-with-tie-break-a-wins",
    "g4-best-of-5-a-wins-3-2",
    "g5-advantage-26-24-recorded-as-played",
    "g5-no-advantage-25-24-recorded-as-played",
  ])("reach the same state as %s", (id) => {
    const goldenCase = GOLDEN_CASES.find((candidate) => candidate.id === id);
    if (goldenCase === undefined) {
      throw new Error(`missing golden case ${id}`);
    }
    const player = createMatchPlayer();

    playByCommands(goldenCase, player);

    expect(player.state()).toStrictEqual(goldenCase.expected.state);
    expect(JSON.stringify(player.state())).toBe(JSON.stringify(goldenCase.expected.state));
  });
});
