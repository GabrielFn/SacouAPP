import { describe, expect, test } from "vitest";

import { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import type { EventEnvelope } from "../event-log/types.js";
import { changeQueue } from "../queue/commands.js";
import {
  confirmSetEnd,
  shiftRotation,
  substitutePlayer,
  switchServingTeam,
} from "../score/commands.js";
import { ORANGE_LINEUP, rotationMatchInput } from "../score/match-player.test.fixture.js";
import type { MatchStartedPayload, MemberId, ScoringRules, TeamQueue } from "../score/types.js";
import { revertToEvent } from "./commands.js";
import { CorrectionPlayer, replayOf } from "./correction-player.test.fixture.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const SHORT_MD3: ScoringRules = { bestOf: 3, pointsPerSet: 3, tieBreakPoints: 3, winMargin: 2 };
const TEAM_WITH_LIBERO_AND_BENCH = 8;
const MIDDLE_BLOCKERS = [2, 5];

function waitingMember(number: number): MemberId {
  return `90000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

/** One whole team and two single players waiting, as in the case of the plan. */
const QUEUE: TeamQueue = {
  teams: [{ memberIds: [1, 2, 3, 4, 5, 6].map(waitingMember) }],
  players: [waitingMember(7), waitingMember(8)],
};
const QUEUE_AFTER_AN_ARRIVAL: TeamQueue = {
  ...QUEUE,
  players: [...QUEUE.players, waitingMember(9)],
};

/** Laranja in zone 1 with a libero on the middles and one on the bench; Azul in zone 5. */
function matchSetup(scoring: ScoringRules): MatchStartedPayload {
  return {
    ...rotationMatchInput(scoring, {
      zones: [1, 5],
      teamSize: TEAM_WITH_LIBERO_AND_BENCH,
      liberoIndexes: [MIDDLE_BLOCKERS, null],
    }),
    queue: QUEUE,
  };
}

const [, OUTSIDE_HITTER] = ORANGE_LINEUP;
const ORANGE_BENCH_MEMBER = "a0000000-0000-4000-8000-000000000008";

/**
 * Points with side-outs, then after the third point a substitution, an arrival in the queue, girar
 * and a switch of the serve, with points in between.
 */
function playScriptedMatch(scoring: ScoringRules): {
  readonly player: CorrectionPlayer;
  readonly thirdPoint: EventEnvelope;
} {
  const upToTheThirdPoint = CorrectionPlayer.start(matchSetup(scoring)).rallies("baa");
  const player = upToTheThirdPoint
    .run((state) => substitutePlayer(state, "a", OUTSIDE_HITTER ?? "", ORANGE_BENCH_MEMBER))
    .run((state) => changeQueue(state, QUEUE_AFTER_AN_ARRIVAL))
    .rallies("bb")
    .run((state) => shiftRotation(state, "a", "forward"))
    .run(switchServingTeam)
    .rallies("ab");
  return { player, thirdPoint: upToTheThirdPoint.last };
}

function prefixUpTo(events: readonly EventEnvelope[], target: EventEnvelope) {
  return events.slice(0, events.indexOf(target) + 1);
}

describe("acceptance: the timeline reverts score, rotation and queue together", () => {
  const { player, thirdPoint } = playScriptedMatch(MD3);
  const before = player.state();
  const corrected = player.correct((timeline) => revertToEvent(timeline, thirdPoint.eventId));
  const reverted = replayOf(corrected.events);
  const expected = replayOf(prefixUpTo(player.events, thirdPoint));

  test("the script changed everything the revert has to bring back", () => {
    const now = before.currentMatch;
    const then = expected.state.currentMatch;

    expect(now?.currentSet?.score).not.toStrictEqual(then?.currentSet?.score);
    expect(now?.currentSet?.servingTeam).not.toBe(then?.currentSet?.servingTeam);
    expect(now?.rotations.a).not.toStrictEqual(then?.rotations.a);
    expect(now?.rotations.b?.setterZone).not.toBe(then?.rotations.b?.setterZone);
    expect(before.queue).not.toStrictEqual(expected.state.queue);
  });

  test("the state is the one right after the third point", () => {
    expect(reverted.state).toStrictEqual(expected.state);
  });

  test("score, serve, zones, bench, libero and queue are the ones of the third point", () => {
    const match = reverted.state.currentMatch;

    expect(match?.currentSet).toMatchObject({ score: { a: 2, b: 1 }, servingTeam: "a" });
    expect(match?.rotations.a).toMatchObject({
      setterZone: 6,
      bench: [ORANGE_BENCH_MEMBER],
      libero: {
        memberId: "a0000000-0000-4000-8000-000000000007",
        replacedIndexes: MIDDLE_BLOCKERS,
      },
      lineup: ORANGE_LINEUP,
    });
    expect(match?.rotations.b?.setterZone).toBe(4);
    expect(reverted.state.queue).toStrictEqual(QUEUE);
  });

  test("the active events are the ones up to the third point", () => {
    expect(reverted.activeEventIds).toStrictEqual(expected.activeEventIds);
  });
});

describe("invariant: a revert to any active event is the replay of the log up to it", () => {
  const { events: log } = playScriptedMatch(SHORT_MD3)
    .player.rallies("b")
    .run(confirmSetEnd)
    .rallies("ab");

  test.each(log.map((event, index) => ({ event, index })))(
    "revert to event $index",
    ({ event }) => {
      const reverted = new CorrectionPlayer(log).append({
        type: REVERTED_TO_EVENT_TYPE,
        payload: { targetEventId: event.eventId },
      });

      expect(replayOf(reverted.events)).toStrictEqual(replayOf(prefixUpTo(log, event)));
    },
  );

  test("the script has a closed set, so the invariant crosses a SetEnded", () => {
    expect(log.some(({ type }) => type === "SetEnded")).toBe(true);
  });
});
