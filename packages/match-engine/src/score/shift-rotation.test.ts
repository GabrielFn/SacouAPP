import type { SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE } from "./appliers.js";
import { scorePoint, shiftRotation, startMatch } from "./commands.js";
import {
  MATCH_ID,
  replayAll,
  rotationMatchInput,
  toEnvelope,
} from "./match-player.test.fixture.js";
import type {
  CourtSessionState,
  RotationDirection,
  ScoreCommandResult,
  ScoringRules,
  TeamSide,
} from "./types.js";

const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const TEAM_WITH_LIBERO_AND_BENCH = 8;
const MIDDLE_BLOCKERS = [2, 5];

/** An oracle apart from the engine, written from the screens: girar 1→6→5→4→3→2→1, desgirar back. */
const EXPECTED_SHIFTS: readonly (readonly [SetterZone, RotationDirection, SetterZone])[] = [
  [1, "forward", 6],
  [6, "forward", 5],
  [5, "forward", 4],
  [4, "forward", 3],
  [3, "forward", 2],
  [2, "forward", 1],
  [1, "backward", 2],
  [2, "backward", 3],
  [3, "backward", 4],
  [4, "backward", 5],
  [5, "backward", 6],
  [6, "backward", 1],
];

type Command = (state: CourtSessionState) => ScoreCommandResult;

function play(zoneA: SetterZone | null, commands: readonly Command[] = []): EventEnvelope[] {
  const events: EventEnvelope[] = [];
  const run = (command: Command) => {
    const result = command(replayAll(events));
    if (!result.ok) {
      throw new Error(`refused: ${result.error.code}`);
    }
    result.value.forEach((draft) => events.push(toEnvelope(draft, events.length + 1)));
  };
  run((state) =>
    startMatch(
      state,
      rotationMatchInput(MD3, {
        zones: [zoneA, 5],
        teamSize: TEAM_WITH_LIBERO_AND_BENCH,
        liberoIndexes: [MIDDLE_BLOCKERS, null],
      }),
    ),
  );
  commands.forEach(run);
  return events;
}

function shift(team: TeamSide, direction: RotationDirection): Command {
  return (state) => shiftRotation(state, team, direction);
}

function point(team: TeamSide): Command {
  return (state) => scorePoint(state, team);
}

describe("shiftRotation", () => {
  test.each(EXPECTED_SHIFTS)("zone %s, %s, goes to zone %s", (from, direction, to) => {
    const before = replayAll(play(from)).currentMatch?.rotations.a;
    const after = replayAll(play(from, [shift("a", direction)])).currentMatch?.rotations.a;

    expect(after).toStrictEqual(before === undefined ? undefined : { ...before, setterZone: to });
  });

  test("records the whole allocation with the absolute zone, bench and libero included", () => {
    const state = replayAll(play(1));
    const result = shiftRotation(state, "a", "forward");
    const teamState = state.currentMatch?.rotations.a;

    expect(result).toStrictEqual({
      ok: true,
      value: [
        {
          type: "LineupChanged",
          payload: {
            bench: teamState?.bench,
            libero: teamState?.libero,
            lineup: teamState?.lineup,
            matchId: MATCH_ID,
            setterZone: 6,
            team: "a",
          },
        },
      ],
    });
    expect(teamState?.bench).toHaveLength(1);
    expect(teamState?.libero?.replacedIndexes).toStrictEqual(MIDDLE_BLOCKERS);
  });

  test("leaves the other team and the score alone", () => {
    const before = replayAll(play(1, [point("b")])).currentMatch;
    const after = replayAll(play(1, [point("b"), shift("a", "backward")])).currentMatch;

    expect(after?.rotations.b).toStrictEqual(before?.rotations.b);
    expect(after?.currentSet).toStrictEqual(before?.currentSet);
  });

  test("a side-out after girar starts from the recorded zone", () => {
    const events = play(1, [shift("a", "forward"), point("b"), point("a")]);

    expect(replayAll(events).currentMatch?.rotations.a?.setterZone).toBe(5);
  });

  test("refuses a team with its rotation off", () => {
    const state = replayAll(play(null));

    expect(shiftRotation(state, "a", "forward")).toStrictEqual({
      ok: false,
      error: { code: "rotation-off" },
    });
  });

  test("refuses a team outside the two sides", () => {
    const state = replayAll(play(1));

    expect(shiftRotation(state, "c" as TeamSide, "forward")).toStrictEqual({
      ok: false,
      error: { code: "invalid-payload", field: "team" },
    });
  });

  test("refuses a direction outside the two", () => {
    const state = replayAll(play(1));

    expect(shiftRotation(state, "a", "sideways" as RotationDirection)).toStrictEqual({
      ok: false,
      error: { code: "invalid-rotation-direction" },
    });
  });

  test("refuses without an open match", () => {
    expect(shiftRotation(INITIAL_COURT_SESSION_STATE, "a", "forward")).toStrictEqual({
      ok: false,
      error: { code: "no-open-match" },
    });
  });
});
