import { FORMATION_CATALOG_VERSION } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE } from "../score/appliers.js";
import { endMatchManually, startMatch } from "../score/commands.js";
import { MAX_QUEUE_MEMBERS } from "../score/constants.data.js";
import { replayAll, toEnvelope } from "../score/match-player.test.fixture.js";
import { getLineupBySlot } from "../score/rotation-rules.js";
import type {
  TeamQueue,
  CourtSessionState,
  MatchStartedPayload,
  MemberId,
  ScoreCommandResult,
  TeamSide,
} from "../score/types.js";
import { changeQueue } from "./commands.js";
import { getConsecutiveMatches, getMatchesPlayed } from "./consecutive-matches.js";
import { planNextMatch } from "./plan-next-match.js";
import type { NextMatchInput, NextMatchPlan } from "./types.js";

const ID_DIGITS = 12;
const PLAYERS_PER_TEAM = 6;
const memberId = (prefix: string, index: number): MemberId =>
  `${prefix}-0000-4000-8000-${String(index).padStart(ID_DIGITS, "0")}`;
const matchId = (index: number) => memberId("f0000000", index);

/** Stand-ins for the names of screen 11: Laranja on side `a`, Azul and its reserves on `b`. */
const ORANGE = [1, 2, 3, 4, 5, 6].map((index) => memberId("a0000000", index));
const [RAFA, DUDA, GIL, HUGO, DAVI, SOFIA, BIA, CAIO] = [1, 2, 3, 4, 5, 6, 7, 8].map((index) =>
  memberId("b0000000", index),
) as [MemberId, MemberId, MemberId, MemberId, MemberId, MemberId, MemberId, MemberId];
const ARRIVAL_ORDER = [RAFA, DUDA, GIL, HUGO, DAVI, SOFIA, BIA, CAIO];
const SCORING = { bestOf: 1, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 } as const;
const NOBODY: TeamQueue = { players: [], teams: [] };

interface CourtPlayer {
  readonly state: () => CourtSessionState;
  readonly run: (command: (state: CourtSessionState) => ScoreCommandResult) => void;
}

/** Plays commands through envelopes, parser and replay, as the app will. */
function createCourtPlayer(): CourtPlayer {
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
    },
  };
}

function firstMatch(blue: readonly MemberId[], queue: TeamQueue): MatchStartedPayload {
  const [setter, ...others] = blue;
  return {
    firstServer: "a",
    formationsVersion: FORMATION_CATALOG_VERSION,
    matchId: matchId(1),
    queue,
    rotations: {
      a: { bench: [], libero: null, lineup: ORANGE, setterZone: 1, system: "5x1" },
      b: {
        bench: [],
        libero: null,
        lineup: [setter as MemberId, ...others],
        setterZone: 6,
        system: "5x1",
      },
    },
    rulesVersion: 1,
    scoring: SCORING,
    teams: { a: { memberIds: ORANGE }, b: { memberIds: blue } },
  };
}

function nextMatch(plan: NextMatchPlan, index: number): MatchStartedPayload {
  const { queue, rotations, teams } = plan;
  return {
    firstServer: "a",
    formationsVersion: FORMATION_CATALOG_VERSION,
    matchId: matchId(index),
    queue,
    rotations,
    rulesVersion: 1,
    scoring: SCORING,
    teams,
  };
}

function planOf(state: CourtSessionState, input: NextMatchInput): NextMatchPlan {
  const planned = planNextMatch(state, input);
  if (!planned.ok) {
    throw new Error(`plan refused: ${planned.error.code}`);
  }
  return planned.value;
}

function manual(chosen: readonly MemberId[]): NextMatchInput {
  return { criterion: "manual", criterionInput: { chosen }, playersPerTeam: PLAYERS_PER_TEAM };
}

const BY_CONSECUTIVE_MATCHES: NextMatchInput = {
  criterion: "consecutive-matches",
  criterionInput: { arrivalOrder: ARRIVAL_ORDER },
  playersPerTeam: PLAYERS_PER_TEAM,
};

function endWith(player: CourtPlayer, winner: TeamSide) {
  player.run((state) => endMatchManually(state, winner));
}

/**
 * The review scenario (`revisao-mvp.md:28`), played with the commands: Laranja wins three times, and
 * Azul loses two members each time to the two reserves who wait. In the first match Azul starts
 * with Gil setting in zone 6, so that Rafa is in position 1 and Duda in position 5.
 */
function playReviewScenario(): CourtPlayer {
  const player = createCourtPlayer();
  const blue = [RAFA, DUDA, GIL, HUGO, DAVI, SOFIA];
  player.run((state) =>
    startMatch(state, {
      ...firstMatch(blue, { players: [BIA, CAIO], teams: [] }),
      rotations: {
        a: { bench: [], libero: null, lineup: ORANGE, setterZone: 1, system: "5x1" },
        b: {
          bench: [],
          libero: null,
          lineup: [GIL, RAFA, HUGO, DAVI, SOFIA, DUDA],
          setterZone: 6,
          system: "5x1",
        },
      },
    }),
  );
  endWith(player, "a");
  const second = planOf(player.state(), manual([GIL, HUGO]));
  player.run((state) => startMatch(state, nextMatch(second, 2)));
  endWith(player, "a");
  const third = planOf(player.state(), manual([DAVI, SOFIA]));
  player.run((state) => startMatch(state, nextMatch(third, 3)));
  endWith(player, "a");
  return player;
}

describe("the review scenario: two reserves, Azul loses", () => {
  const player = playReviewScenario();
  const state = player.state();
  const plan = planOf(state, BY_CONSECUTIVE_MATCHES);

  test("counts matches in a row, not matches in the round", () => {
    const counts = [RAFA, DUDA, BIA, CAIO, GIL, HUGO].map((id) => getConsecutiveMatches(state, id));

    expect(counts).toStrictEqual([3, 3, 2, 2, 1, 1]);
    expect(getMatchesPlayed(state, GIL)).toBe(2);
  });

  test("Rafa and Duda leave, Davi takes position 1 and Sofia position 5", () => {
    const blue = plan.rotations.b;
    const bySlot = blue === null ? [] : getLineupBySlot(blue.lineup, blue.setterZone);

    expect(plan.exits.map(({ outgoing, incoming }) => [outgoing, incoming])).toStrictEqual([
      [RAFA, DAVI],
      [DUDA, SOFIA],
    ]);
    expect(bySlot[0]).toBe(DAVI);
    expect(bySlot[4]).toBe(SOFIA);
    expect(plan.queue).toStrictEqual({ players: [RAFA, DUDA], teams: [] });
  });

  test("the winner and the rotation of the end stay", () => {
    const last = state.finishedMatches.at(-1);

    expect(plan.teams.a).toStrictEqual(last?.teams.a);
    expect(plan.rotations.a).toStrictEqual(last?.rotations.a);
    expect(plan.rotations.b?.setterZone).toBe(last?.rotations.b?.setterZone);
  });

  test("the plan starts the next match, and the replay records the queue", () => {
    player.run((current) => startMatch(current, nextMatch(plan, 4)));

    expect(player.state().queue).toStrictEqual(plan.queue);
  });
});

describe("changeQueue", () => {
  function opened(queue: TeamQueue): CourtSessionState {
    const player = createCourtPlayer();
    player.run((state) =>
      startMatch(state, firstMatch([RAFA, DUDA, GIL, HUGO, DAVI, SOFIA], queue)),
    );
    return player.state();
  }

  test("drafts the whole queue for whoever arrived", () => {
    const result = changeQueue(opened({ players: [BIA], teams: [] }), {
      players: [BIA, CAIO],
      teams: [],
    });

    expect(result).toStrictEqual({
      ok: true,
      value: [
        {
          type: "QueueChanged",
          payload: { matchId: matchId(1), queue: { players: [BIA, CAIO], teams: [] } },
        },
      ],
    });
  });

  test("refuses with no open match", () => {
    expect(changeQueue(INITIAL_COURT_SESSION_STATE, NOBODY)).toStrictEqual({
      ok: false,
      error: { code: "no-open-match" },
    });
  });

  test("refuses someone who is on the court", () => {
    expect(changeQueue(opened(NOBODY), { players: [RAFA], teams: [] })).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "queue" },
    });
  });

  test("refuses the same queue", () => {
    const queue = { players: [BIA], teams: [{ memberIds: [CAIO] }] };

    expect(changeQueue(opened(queue), queue)).toStrictEqual({
      ok: false,
      error: { code: "queue-unchanged" },
    });
  });

  test("refuses a queue past the limit, with the field and never the value", () => {
    const players = Array.from({ length: MAX_QUEUE_MEMBERS + 1 }, (_, index) =>
      memberId("90000000", index + 1),
    );

    expect(changeQueue(opened(NOBODY), { players, teams: [] })).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "queue.players" },
    });
  });
});

describe("startMatch with a queue", () => {
  test("refuses a queue with someone on the court", () => {
    const input = firstMatch([RAFA, DUDA, GIL, HUGO, DAVI, SOFIA], { players: [DUDA], teams: [] });

    expect(startMatch(INITIAL_COURT_SESSION_STATE, input)).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "queue" },
    });
  });
});

describe("planNextMatch", () => {
  test("plans from the queue changed during the match", () => {
    const player = createCourtPlayer();
    player.run((state) =>
      startMatch(state, firstMatch([RAFA, DUDA, GIL, HUGO, DAVI, SOFIA], NOBODY)),
    );
    player.run((state) => changeQueue(state, { players: [BIA], teams: [] }));
    endWith(player, "a");

    const plan = planOf(player.state(), {
      criterion: "arrival-order",
      criterionInput: { arrivalOrder: ARRIVAL_ORDER },
      playersPerTeam: PLAYERS_PER_TEAM,
    });

    expect(plan.exits.map(({ outgoing, incoming }) => [outgoing, incoming])).toStrictEqual([
      [RAFA, BIA],
    ]);
  });

  test("refuses a queue that would grow past the limit", () => {
    const waiting = Array.from({ length: MAX_QUEUE_MEMBERS }, (_, index) =>
      memberId("90000000", index + 1),
    );
    const player = createCourtPlayer();
    player.run((state) =>
      startMatch(
        state,
        firstMatch([RAFA, DUDA, GIL, HUGO, DAVI, SOFIA], {
          players: waiting.slice(1),
          teams: [{ memberIds: waiting.slice(0, 1) }],
        }),
      ),
    );
    endWith(player, "a");

    expect(planNextMatch(player.state(), BY_CONSECUTIVE_MATCHES)).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "queue" },
    });
  });
});
