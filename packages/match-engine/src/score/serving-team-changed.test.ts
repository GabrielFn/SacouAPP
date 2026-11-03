import { describe, expect, test } from "vitest";

import type { EventEnvelope } from "../event-log/types.js";
import { INITIAL_COURT_SESSION_STATE, SCORE_APPLIERS } from "./appliers.js";
import { confirmSetEnd, scorePoint, startMatch, switchServingTeam } from "./commands.js";
import { SERVING_TEAM_CHANGED_EVENT_TYPE } from "./constants.data.js";
import {
  MATCH_ID,
  matchInput,
  numberedMatchId,
  ORANGE_LINEUP,
  replayAll,
  rotationMatchInput,
  type RotationSetup,
  toEnvelope,
} from "./match-player.test.fixture.js";
import { getCurrentServingPlayer, getLiberoSlot, getOnCourtBySlot } from "./rotation-rules.js";
import type {
  CourtSessionState,
  MatchStartedPayload,
  ScoreCommandResult,
  ScoreEventDraft,
  ScoringRules,
  ServingTeamChangedPayload,
  TeamSide,
} from "./types.js";

const SHORT_MD3: ScoringRules = { bestOf: 3, pointsPerSet: 2, tieBreakPoints: 2, winMargin: 2 };
const MD3: ScoringRules = { bestOf: 3, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 };
const TEAM_WITH_LIBERO = 7;
const MIDDLE_BLOCKERS = [2, 5];
const SLOT_1 = 1;

type Command = (state: CourtSessionState) => ScoreCommandResult;

class Recorder {
  readonly events: EventEnvelope[] = [];

  constructor(input: MatchStartedPayload) {
    this.run((state) => startMatch(state, input));
  }

  state(): CourtSessionState {
    return replayAll(this.events);
  }

  run(command: Command): readonly ScoreEventDraft[] {
    const result = command(this.state());
    if (!result.ok) {
      throw new Error(`refused: ${result.error.code}`);
    }
    result.value.forEach((draft) => {
      this.push(draft);
    });
    return result.value;
  }

  push(draft: ScoreEventDraft): void {
    this.events.push(toEnvelope(draft, this.events.length + 1));
  }

  points(team: TeamSide, count: number): void {
    Array.from({ length: count }).forEach(() => this.run((state) => scorePoint(state, team)));
  }
}

function rotationRecorder(scoring: ScoringRules, setup: RotationSetup = {}): Recorder {
  return new Recorder(rotationMatchInput(scoring, setup));
}

function servingTeamChanged(payload: ServingTeamChangedPayload): ScoreEventDraft {
  return { type: SERVING_TEAM_CHANGED_EVENT_TYPE, payload };
}

function applyRaw(state: CourtSessionState, payload: ServingTeamChangedPayload) {
  const applier = SCORE_APPLIERS.get(SERVING_TEAM_CHANGED_EVENT_TYPE);
  return applier?.(state, toEnvelope(servingTeamChanged(payload), 1));
}

describe("switchServingTeam", () => {
  test("at 0–0 of set 2 it changes who serves and who served first", () => {
    const recorder = rotationRecorder(SHORT_MD3);
    recorder.points("a", 2);
    recorder.run(confirmSetEnd);

    expect(recorder.run(switchServingTeam)).toStrictEqual([
      servingTeamChanged({ firstServer: "a", matchId: MATCH_ID, servingTeam: "a", setNumber: 2 }),
    ]);
    expect(recorder.state().currentMatch?.currentSet).toMatchObject({
      firstServer: "a",
      servingTeam: "a",
      setNumber: 2,
    });
  });

  test("the next set alternates from the corrected first server", () => {
    const recorder = rotationRecorder(SHORT_MD3);
    recorder.points("a", 2);
    recorder.run(confirmSetEnd);
    recorder.run(switchServingTeam);
    recorder.points("b", 2);
    recorder.run(confirmSetEnd);

    expect(recorder.state().currentMatch?.currentSet).toMatchObject({
      firstServer: "b",
      servingTeam: "b",
      setNumber: 3,
    });
  });

  test("at 10–8 only the serve changes: first server and zones stay", () => {
    const recorder = rotationRecorder(MD3, { zones: [1, 5] });
    recorder.points("a", 10);
    recorder.points("b", 8);
    const before = recorder.state().currentMatch;

    expect(recorder.run(switchServingTeam)).toStrictEqual([
      servingTeamChanged({ firstServer: "a", matchId: MATCH_ID, servingTeam: "a", setNumber: 1 }),
    ]);
    const after = recorder.state().currentMatch;
    expect(after?.currentSet).toStrictEqual(
      before?.currentSet === null || before?.currentSet === undefined
        ? before?.currentSet
        : { ...before.currentSet, servingTeam: "a" },
    );
    expect(after?.rotations).toStrictEqual(before?.rotations);
  });

  test("the next point of the new server does not rotate it", () => {
    const recorder = rotationRecorder(MD3, { zones: [1, 5] });
    recorder.points("a", 10);
    recorder.points("b", 8);
    recorder.run(switchServingTeam);
    const zones = recorder.state().currentMatch?.rotations;
    recorder.points("a", 1);

    expect(recorder.state().currentMatch?.rotations).toStrictEqual(zones);
    expect(recorder.state().currentMatch?.currentSet?.score).toStrictEqual({ a: 11, b: 8 });
  });

  test("the server of the new serving team is the one in slot 1, without rotating", () => {
    const recorder = rotationRecorder(MD3, { zones: [1, 5] });
    recorder.run(switchServingTeam);
    const match = recorder.state().currentMatch;

    expect(match === null ? null : getCurrentServingPlayer(match)).toBe(
      "b0000000-0000-4000-8000-000000000003",
    );
  });

  test("refuses a decided set", () => {
    const recorder = rotationRecorder(SHORT_MD3);
    recorder.points("a", 2);

    expect(switchServingTeam(recorder.state())).toStrictEqual({
      ok: false,
      error: { code: "set-decided" },
    });
  });

  test("refuses a closed set", () => {
    const recorder = rotationRecorder(SHORT_MD3);
    recorder.points("a", 2);
    recorder.run(confirmSetEnd);
    recorder.points("a", 2);
    const deciding = confirmSetEnd(recorder.state());
    const [setEnded] = deciding.ok ? deciding.value : [];
    if (setEnded === undefined) {
      throw new Error("no SetEnded");
    }
    // Only the first of the two events of the deciding confirmation is stored.
    recorder.push(setEnded);

    expect(switchServingTeam(recorder.state())).toStrictEqual({
      ok: false,
      error: { code: "no-open-set" },
    });
  });

  test("refuses without an open match", () => {
    expect(switchServingTeam(INITIAL_COURT_SESSION_STATE)).toStrictEqual({
      ok: false,
      error: { code: "no-open-match" },
    });
  });

  test("is accepted with the rotation off in both teams", () => {
    const recorder = new Recorder(matchInput(MD3));
    recorder.points("b", 3);
    recorder.run(switchServingTeam);

    expect(recorder.state().currentMatch?.currentSet).toMatchObject({
      firstServer: "a",
      score: { a: 0, b: 3 },
      servingTeam: "a",
    });
  });

  test("the libero of the team that now receives covers position 1", () => {
    const recorder = rotationRecorder(MD3, {
      zones: [5, 1],
      teamSize: TEAM_WITH_LIBERO,
      liberoIndexes: [MIDDLE_BLOCKERS, null],
    });
    const orange = () => recorder.state().currentMatch?.rotations.a ?? null;
    const libero = orange()?.libero?.memberId;

    expect(getLiberoSlot(orange() ?? { libero: null, setterZone: 1 }, "serving")).toBeNull();
    recorder.run(switchServingTeam);
    const teamState = orange();
    const phase =
      recorder.state().currentMatch?.currentSet?.servingTeam === "a" ? "serving" : "receiving";

    expect(phase).toBe("receiving");
    expect(teamState === null ? null : getLiberoSlot(teamState, phase)).toBe(SLOT_1);
    expect(teamState === null ? null : getOnCourtBySlot(teamState, phase)[0]).toBe(libero);
    expect(libero).not.toBe(ORANGE_LINEUP[2]);
  });
});

describe("ServingTeamChanged applier", () => {
  const recorder = rotationRecorder(MD3, { zones: [1, 5] });
  recorder.points("b", 2);
  const state = recorder.state();
  const payload: ServingTeamChangedPayload = {
    firstServer: "b",
    matchId: MATCH_ID,
    servingTeam: "a",
    setNumber: 1,
  };

  test("records both fields as they come, without checking the score", () => {
    const applied = applyRaw(state, payload);

    expect(applied?.ok === true ? applied.value.currentMatch?.currentSet : null).toMatchObject({
      firstServer: "b",
      score: { a: 0, b: 2 },
      servingTeam: "a",
    });
  });

  test("rejects another set number", () => {
    expect(applyRaw(state, { ...payload, setNumber: 2 })).toStrictEqual({
      ok: false,
      error: { code: "event-rejected" },
    });
  });

  test("rejects another match", () => {
    expect(applyRaw(state, { ...payload, matchId: numberedMatchId(2) })).toStrictEqual({
      ok: false,
      error: { code: "event-rejected" },
    });
  });

  test("rejects without an open match", () => {
    expect(applyRaw(INITIAL_COURT_SESSION_STATE, payload)).toStrictEqual({
      ok: false,
      error: { code: "event-rejected" },
    });
  });

  test("a value equal to the current one changes nothing", () => {
    const set = state.currentMatch?.currentSet;
    const same = {
      ...payload,
      firstServer: set?.firstServer ?? "a",
      servingTeam: set?.servingTeam ?? "a",
    };

    expect(applyRaw(state, same)).toStrictEqual({ ok: true, value: state });
  });

  test("of two writers, the last one in the order wins", () => {
    const twice = new Recorder(rotationMatchInput(MD3, { zones: [1, 5] }));
    twice.push(servingTeamChanged({ ...payload, servingTeam: "b", firstServer: "b" }));
    twice.push(servingTeamChanged({ ...payload, servingTeam: "a", firstServer: "a" }));

    expect(twice.state().currentMatch?.currentSet).toMatchObject({
      firstServer: "a",
      servingTeam: "a",
    });
  });
});
