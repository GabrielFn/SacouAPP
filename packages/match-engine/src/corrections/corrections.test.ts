import { describe, expect, test } from "vitest";

import type { EventEnvelope } from "../event-log/types.js";
import { changeQueue } from "../queue/commands.js";
import { confirmSetEnd, shiftRotation, startMatch, switchServingTeam } from "../score/commands.js";
import {
  BLUE_LINEUP,
  numberedMatchId,
  ORANGE_LINEUP,
  rotationMatchInput,
} from "../score/match-player.test.fixture.js";
import type { MemberId, ScoringRules } from "../score/types.js";
import { revertToEvent, undoLastAction } from "./commands.js";
import { CORRECTION_TIMELINE_POINTS } from "./constants.data.js";
import { CorrectionPlayer, eventIdOf, timelineOf } from "./correction-player.test.fixture.js";
import { previewRevert } from "./preview.js";
import { getRecentPoints } from "./timeline.js";
import type { RecentPoint } from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const SINGLE_SHORT_SET: ScoringRules = {
  bestOf: 1,
  pointsPerSet: 2,
  tieBreakPoints: null,
  winMargin: 2,
};

const WAITING_PLAYER = "90000000-0000-4000-8000-000000000001";
const [PEDRO, , , MARCOS, BIA, JOAO] = ORANGE_LINEUP;
const [GABI, , , , DUDA, LEO] = BLUE_LINEUP;

function refused(code: string) {
  return { ok: false, error: { code } };
}

function revertDraft(targetEventId: string) {
  return { ok: true, value: [{ type: "RevertedTo", payload: { targetEventId } }] };
}

/** Laranja (a) in zone 1 serves first; Azul (b) in zone 5. */
function screenMatch(): CorrectionPlayer {
  return CorrectionPlayer.start(rotationMatchInput(MD3, { zones: [1, 5] }));
}

/**
 * Screen 25 and then screen 09: set 1 ends 25–22 for Laranja, and set 2 reaches 18–15 (82 events).
 * The last ten points are the ten lines of screen 24.
 */
function screen24Match(): CorrectionPlayer {
  return screenMatch()
    .rallies(`${"b".repeat(22)}${"a".repeat(25)}`)
    .run(confirmSetEnd)
    .rallies(`${"a".repeat(12)}${"b".repeat(11)}aabbaabbaa`);
}

function line(
  sequence: number,
  team: "a" | "b",
  score: readonly [number, number],
  servingTeam: "a" | "b",
  servingPlayer: MemberId | undefined,
  setterZone: RecentPoint["setterZone"] = null,
): RecentPoint {
  return {
    eventId: eventIdOf(sequence),
    team,
    score: { a: score[0], b: score[1] },
    servingTeam,
    servingPlayer: servingPlayer ?? null,
    sideOut: setterZone !== null,
    setterZone,
    author: null,
    kind: null,
  };
}

/** Written from `design/telas/Corrigir.dc.html`, most recent first: score, team, server, rot. */
const SCREEN_24_LINES: readonly RecentPoint[] = [
  line(82, "a", [18, 15], "a", JOAO),
  line(81, "a", [17, 15], "b", GABI, 2),
  line(80, "b", [16, 15], "b", GABI),
  line(79, "b", [16, 14], "a", BIA, 1),
  line(78, "a", [16, 13], "a", BIA),
  line(77, "a", [15, 13], "b", LEO, 3),
  line(76, "b", [14, 13], "b", LEO),
  line(75, "b", [14, 12], "a", MARCOS, 2),
  line(74, "a", [14, 11], "a", MARCOS),
  line(73, "a", [13, 11], "b", DUDA, 4),
];

describe("undoLastAction", () => {
  test("right after the MatchStarted there is nothing to undo", () => {
    expect(undoLastAction(screenMatch().timeline())).toStrictEqual(refused("nothing-to-undo"));
  });

  test("undoing again and again goes from 3–2 back to 0–0, and then there is nothing", () => {
    let player = screenMatch();
    player = player.rallies("aabab");
    const scores = Array.from({ length: 5 }, () => {
      player = player.correct(undoLastAction);
      return player.state().currentMatch?.currentSet?.score;
    });

    expect(scores).toStrictEqual([
      { a: 3, b: 1 },
      { a: 2, b: 1 },
      { a: 2, b: 0 },
      { a: 1, b: 0 },
      { a: 0, b: 0 },
    ]);
    expect(undoLastAction(player.timeline())).toStrictEqual(refused("nothing-to-undo"));
  });

  test("undoing a side-out gives the serve back and turns only the team that rotated back", () => {
    let player = screenMatch();
    const before = player.state().currentMatch?.rotations;
    player = player.point("b");

    expect(player.state().currentMatch?.rotations.b?.setterZone).toBe(4);
    player = player.correct(undoLastAction);
    expect(player.state().currentMatch?.currentSet?.servingTeam).toBe("a");
    expect(player.state().currentMatch?.rotations).toStrictEqual(before);
  });

  test("points at the event right before the last one", () => {
    let player = screenMatch();
    player = player.rallies("ab");

    expect(undoLastAction(player.timeline())).toStrictEqual(revertDraft(eventIdOf(2)));
  });

  test("undoing the end of set 1 brings back the decided 25–20, and the same SetEnded again", () => {
    let player = screenMatch();
    player = player.rallies(`${"b".repeat(20)}${"a".repeat(25)}`);
    player = player.run(confirmSetEnd);
    const setEnded = player.last;
    player = player.correct(undoLastAction);

    expect(player.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 25, b: 20 });
    const again = confirmSetEnd(player.state());
    expect(again.ok ? again.value.map(({ payload }) => payload) : null).toStrictEqual([
      setEnded.payload,
    ]);
  });

  test("after the match ended there is no open match to correct", () => {
    let player = CorrectionPlayer.start(rotationMatchInput(SINGLE_SHORT_SET));
    player = player.rallies("aa");
    player = player.run(confirmSetEnd);

    expect(undoLastAction(player.timeline())).toStrictEqual(refused("no-open-match"));
  });

  test("without events there is no open match", () => {
    expect(undoLastAction(timelineOf([]))).toStrictEqual(refused("no-open-match"));
  });
});

describe("revertToEvent", () => {
  test("goes back to any active event of the open match, the MatchStarted included", () => {
    let player = screenMatch();
    const [first] = player.events;
    player = player.rallies("abba");

    expect(revertToEvent(player.timeline(), first?.eventId ?? "")).toStrictEqual(
      revertDraft(eventIdOf(1)),
    );
    expect(revertToEvent(player.timeline(), eventIdOf(3))).toStrictEqual(revertDraft(eventIdOf(3)));
  });

  test("the last active event is not a correction", () => {
    let player = screenMatch();
    player = player.rallies("ab");

    expect(revertToEvent(player.timeline(), eventIdOf(3))).toStrictEqual(
      refused("nothing-to-undo"),
    );
  });

  test("refuses an event that is no longer active", () => {
    let player = screenMatch();
    player = player.rallies("aba");
    player = player.correct((timeline) => revertToEvent(timeline, eventIdOf(2)));
    player = player.point("b");

    expect(revertToEvent(player.timeline(), eventIdOf(3))).toStrictEqual(
      refused("invalid-revert-target"),
    );
  });

  test("refuses an event of a match that already ended", () => {
    let player = CorrectionPlayer.start(rotationMatchInput(SINGLE_SHORT_SET));
    player = player.rallies("aa");
    player = player.run(confirmSetEnd);
    player = player.run((state) =>
      startMatch(state, rotationMatchInput(SINGLE_SHORT_SET, { matchId: numberedMatchId(2) })),
    );
    player = player.point("b");

    expect(revertToEvent(player.timeline(), eventIdOf(2))).toStrictEqual(
      refused("invalid-revert-target"),
    );
  });

  test("refuses an id that is not in the log, and does not echo it", () => {
    let player = screenMatch();
    player = player.rallies("ab");

    expect(revertToEvent(player.timeline(), "player@example.com")).toStrictEqual(
      refused("invalid-revert-target"),
    );
  });

  test("refuses without an open match", () => {
    let player = CorrectionPlayer.start(rotationMatchInput(SINGLE_SHORT_SET));
    player = player.rallies("aa");
    player = player.run(confirmSetEnd);

    expect(revertToEvent(player.timeline(), eventIdOf(2))).toStrictEqual(refused("no-open-match"));
  });
});

describe("getRecentPoints", () => {
  test("reproduces the ten lines of screen 24, from 18–15 to 13–11", () => {
    expect(getRecentPoints(screen24Match().timeline())).toStrictEqual(SCREEN_24_LINES);
  });

  test("lists ten points by default", () => {
    expect(CORRECTION_TIMELINE_POINTS).toBe(SCREEN_24_LINES.length);
  });

  test("with fewer points than the limit, lists all of them", () => {
    let player = screenMatch();
    player = player.rallies("ab");

    expect(getRecentPoints(player.timeline())).toStrictEqual([
      line(3, "b", [1, 1], "a", PEDRO, 4),
      line(2, "a", [1, 0], "a", PEDRO),
    ]);
  });

  test("a reverted point is not listed", () => {
    let player = screen24Match();
    player = player.correct(undoLastAction);

    expect(getRecentPoints(player.timeline(), 2)).toStrictEqual(SCREEN_24_LINES.slice(1, 3));
  });

  test("lists only the current set", () => {
    let player = screenMatch();
    player = player.rallies("a".repeat(25));
    player = player.run(confirmSetEnd);

    expect(getRecentPoints(player.timeline())).toStrictEqual([]);
    player = player.point("a");
    expect(getRecentPoints(player.timeline())).toHaveLength(1);
  });

  test("the server is null when the serving team has its rotation off", () => {
    let player = CorrectionPlayer.start(rotationMatchInput(MD3, { zones: [null, 5] }));
    player = player.rallies("b");

    expect(getRecentPoints(player.timeline())).toStrictEqual([
      line(2, "b", [0, 1], "a", undefined, 4),
    ]);
  });

  test("a limit that is not a count lists nothing", () => {
    const timeline = screen24Match().timeline();

    [-1, 1.5, Number.NaN].forEach((limit) => {
      expect(getRecentPoints(timeline, limit)).toStrictEqual([]);
    });
  });

  test("without an open match lists nothing", () => {
    expect(getRecentPoints(timelineOf([]))).toStrictEqual([]);
  });
});

describe("previewRevert", () => {
  test("at 16–14 of screen 24: score, serve of Azul with Gabi, Laranja 2 to 3, 3 points", () => {
    expect(previewRevert(screen24Match().timeline(), eventIdOf(79))).toStrictEqual({
      ok: true,
      value: {
        targetEventId: eventIdOf(79),
        current: { setNumber: 2, score: { a: 18, b: 15 } },
        reverted: { setNumber: 2, score: { a: 16, b: 14 } },
        servingTeam: "b",
        servingPlayer: GABI,
        rotationChanges: [{ team: "a", from: 2, to: 3 }],
        removed: {
          points: 3,
          lineupChanges: 0,
          queueChanges: 0,
          servingChanges: 0,
          setEnds: 0,
          attributions: 0,
        },
      },
    });
  });

  test("counts every kind of action that leaves the timeline", () => {
    let player = screenMatch();
    player = player.rallies("a".repeat(24));
    const target = eventIdOf(player.events.length);
    player = player.rallies("a");
    player = player.run(confirmSetEnd);
    player = player.run(switchServingTeam);
    player = player.run((state) => shiftRotation(state, "a", "backward"));
    player = player.run((state) => changeQueue(state, { teams: [], players: [WAITING_PLAYER] }));
    const preview = previewRevert(player.timeline(), target);

    expect(preview.ok ? preview.value.removed : null).toStrictEqual({
      points: 1,
      lineupChanges: 1,
      queueChanges: 1,
      servingChanges: 1,
      setEnds: 1,
      attributions: 0,
    });
    expect(preview.ok ? preview.value.current : null).toStrictEqual({
      setNumber: 2,
      score: { a: 0, b: 0 },
    });
    expect(preview.ok ? preview.value.reverted : null).toStrictEqual({
      setNumber: 1,
      score: { a: 24, b: 0 },
    });
  });

  test("has the refusals of revertToEvent", () => {
    let player = screenMatch();
    player = player.rallies("ab");
    const timeline = player.timeline();

    expect(previewRevert(timeline, eventIdOf(3))).toStrictEqual(refused("nothing-to-undo"));
    expect(previewRevert(timeline, eventIdOf(9))).toStrictEqual(refused("invalid-revert-target"));
    expect(previewRevert(timelineOf([]), eventIdOf(1))).toStrictEqual(refused("no-open-match"));
  });

  test("records nothing: the log is the same after it", () => {
    const player = screen24Match();
    const events: readonly EventEnvelope[] = [...player.events];
    previewRevert(player.timeline(), eventIdOf(79));

    expect(player.events).toStrictEqual(events);
  });
});
