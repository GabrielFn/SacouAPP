import { FORMATION_CATALOG_VERSION } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { endMatchManually, startMatch } from "../score/commands.js";
import { replayAll, toEnvelope } from "../score/match-player.test.fixture.js";
import type { CourtSessionState, MemberId } from "../score/types.js";
import { planNextMatch } from "./plan-next-match.js";
import type { NextMatchInput } from "./types.js";

const ID_DIGITS = 12;
const memberId = (prefix: string, index: number): MemberId =>
  `${prefix}-0000-4000-8000-${String(index).padStart(ID_DIGITS, "0")}`;
const TEAM_SIZE = 2;
const BLUE = [1, 2].map((index) => memberId("b0000000", index));
const ORANGE = [1, 2].map((index) => memberId("a0000000", index));
const WAITING = memberId("c0000000", 1);

/** One finished match won by side `a`, with one single player waiting to replace a loser. */
function stateAfterOneMatch(): CourtSessionState {
  const started = startMatch(replayAll([]), {
    firstServer: "a",
    formationsVersion: FORMATION_CATALOG_VERSION,
    matchId: memberId("f0000000", 1),
    queue: { players: [WAITING], teams: [] },
    rotations: { a: null, b: null },
    rulesVersion: 1,
    scoring: { bestOf: 1, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 },
    teams: { a: { memberIds: ORANGE }, b: { memberIds: BLUE } },
  });
  if (!started.ok) {
    throw new Error(`start refused: ${started.error.code}`);
  }
  const events = started.value.map((draft, index) => toEnvelope(draft, index + 1));
  const ended = endMatchManually(replayAll(events), "a");
  if (!ended.ok) {
    throw new Error(`end refused: ${ended.error.code}`);
  }
  return replayAll([
    ...events,
    ...ended.value.map((draft, index) => toEnvelope(draft, events.length + index + 1)),
  ]);
}

describe("criterion keys come only from the own keys of the criteria map", () => {
  const INHERITED_KEYS = ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"];

  test.each(INHERITED_KEYS)("refuses the inherited key %s", (criterion) => {
    const input = {
      criterion,
      criterionInput: { arrivalOrder: [...BLUE] },
      playersPerTeam: TEAM_SIZE,
    } as unknown as NextMatchInput;

    expect(planNextMatch(stateAfterOneMatch(), input)).toStrictEqual({
      ok: false,
      error: { code: "invalid-exit-choice" },
    });
  });

  test("still accepts a real key on the same state", () => {
    const input: NextMatchInput = {
      criterion: "arrival-order",
      criterionInput: { arrivalOrder: [...BLUE] },
      playersPerTeam: TEAM_SIZE,
    };

    expect(planNextMatch(stateAfterOneMatch(), input).ok).toBe(true);
  });
});
