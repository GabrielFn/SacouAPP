import {
  INITIAL_COURT_SESSION_STATE,
  parseMatchStartedPayload,
  startMatch,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  initialLineupEditorState,
  lineupEditorReducer,
  type LineupBase,
  type LineupEditorAction,
} from "../../lineup/model/lineup-editor.reducer";
import { benchPoolOf, lineupView } from "../../lineup/model/lineup-selectors";
import { RESERVES, TEAM_A, TEAM_B } from "./draw.test.fixture";
import { buildMatchStart, teamRotation } from "./match-start";
import type { PreGameChoices, SavedLineup } from "./pre-game";
import { toSavedLineup } from "./pre-game-lineup";
import { preGameLineupSource, savedLineupsOf } from "./pre-game-lineup-source";
import { rotationView } from "./pre-game-selectors";
import {
  g1Input,
  g1UuidArrangement,
  g1UuidNames,
  preGameSettings,
  uuidOf,
} from "./pre-game.test.fixture";

const nameOf = g1UuidNames();
const MATCH_ID = "b0000000-0000-4000-8000-000000000001";
const DAVI = uuidOf("davi");
const SOFIA = uuidOf("sofia");

function defaultOf(side: TeamSide): TeamState {
  const rotation = teamRotation(g1Input(), side);
  if (rotation === null) throw new Error("no rotation");
  return rotation;
}

function saved(side: TeamSide, patch: Partial<SavedLineup>): PreGameChoices["lineups"] {
  return { [side]: { ...toSavedLineup(defaultOf(side)), ...patch } };
}

function started(preGame: Partial<PreGameChoices>, arrangement = g1UuidArrangement()) {
  const payload = buildMatchStart(g1Input(preGame, undefined, arrangement), MATCH_ID);
  if (!payload.ok) throw new Error("not built");
  return payload.value;
}

describe("reserves on the bench of a team at the start (R96)", () => {
  test("1. Davi on the bench of Laranja: in the team and in the bench, out of the queue", () => {
    const payload = started({ lineups: saved("a", { bench: [DAVI] }) });
    expect(payload.teams.a.memberIds).toEqual([...TEAM_A.map(uuidOf), DAVI]);
    expect(payload.rotations.a?.bench).toEqual([DAVI]);
    expect(payload.queue.players).toEqual([SOFIA]);
    expect(parseMatchStartedPayload(payload).ok).toBe(true);
    expect(startMatch(INITIAL_COURT_SESSION_STATE, payload).ok).toBe(true);
  });

  test("2. the bench keeps the order of the queue; the queue can be emptied", () => {
    const payload = started({ lineups: saved("a", { bench: [SOFIA, DAVI] }) });
    expect(payload.rotations.a?.bench).toEqual([DAVI, SOFIA]);
    expect(payload.queue.players).toEqual([]);
    expect(startMatch(INITIAL_COURT_SESSION_STATE, payload).ok).toBe(true);
  });

  test("4. the bench of Laranja never reaches Azul", () => {
    const lineups = { ...saved("a", { bench: [DAVI] }), ...saved("b", { bench: [DAVI, SOFIA] }) };
    const payload = started({ lineups });
    expect(payload.rotations.a?.bench).toEqual([DAVI]);
    expect(payload.rotations.b?.bench).toEqual([SOFIA]);
  });

  test("5. the same name is never libero and bench of a team", () => {
    const payload = started({ lineups: saved("a", { libero: DAVI, bench: [DAVI, SOFIA] }) });
    expect(payload.rotations.a?.libero?.memberId).toBe(DAVI);
    expect(payload.rotations.a?.bench).toEqual([SOFIA]);
    expect(payload.teams.a.memberIds).toHaveLength(TEAM_A.length + 2);
    expect(startMatch(INITIAL_COURT_SESSION_STATE, payload).ok).toBe(true);
  });

  test("6. Davi swapped into the team on the 07: he leaves the bench in silence", () => {
    const swapped = g1UuidArrangement([["davi", ...TEAM_A.slice(1)], TEAM_B], ["ana", "sofia"]);
    const payload = started({ lineups: saved("a", { bench: [DAVI] }) }, swapped);
    expect(payload.rotations.a?.bench).toEqual([]);
    expect(payload.queue.players).toEqual([uuidOf("ana"), SOFIA]);
    expect(parseMatchStartedPayload(payload).ok).toBe(true);
  });

  test("7. another system on the 08 brings the default, with no bench", () => {
    const payload = started({
      lineups: saved("a", { bench: [DAVI] }),
      systems: { a: "6x2", b: null },
    });
    expect(payload.rotations.a?.bench).toEqual([]);
    expect(payload.queue.players).toEqual(RESERVES.map(uuidOf));
  });

  test("8. a team without rotation has no bench", () => {
    const off = preGameSettings((settings) => ({
      ...settings,
      rotation: { ...settings.rotation, enabled: false },
    }));
    const lineups = saved("a", { bench: [DAVI] });
    const payload = buildMatchStart(g1Input({ lineups }, off), MATCH_ID);
    expect(payload.ok && payload.value.rotations.a).toBeNull();
    expect(payload.ok && payload.value.queue.players).toEqual(RESERVES.map(uuidOf));
  });

  test("13. the 08 says the bench, with and without a libero", () => {
    const bench = rotationView(g1Input({ lineups: saved("a", { bench: [DAVI] }) }), nameOf);
    expect(bench?.benchLine).toBe("Laranja tem 6 e banco Davi.");
    const lineups = saved("a", { libero: SOFIA, bench: [DAVI] });
    const both = rotationView(g1Input({ lineups }), nameOf);
    expect(both?.benchLine).toBe("Laranja tem 6, líbero Sofia e banco Davi.");
  });

  test("15. the event carries only IDs", () => {
    const text = JSON.stringify(started({ lineups: saved("a", { bench: [DAVI] }) }));
    expect(text.toLowerCase()).not.toContain("level");
    expect(text).not.toContain("Davi");
  });
});

describe("the bench on screen 22 (R96)", () => {
  const source = (preGame: Partial<PreGameChoices> = {}, arrangement = g1UuidArrangement()) =>
    preGameLineupSource(g1Input(preGame, undefined, arrangement), nameOf, 1);
  const baseOf = (side: TeamSide): LineupBase => {
    const base = source().teams[side].base;
    if (base === null) throw new Error("no base");
    return base;
  };
  const toggle = (side: TeamSide, memberId: string): LineupEditorAction => ({
    type: "bench-toggled",
    base: baseOf(side),
    memberId,
    pool: source().teams[side].benchPool ?? [],
  });
  const run = (...actions: readonly LineupEditorAction[]) =>
    actions.reduce(lineupEditorReducer, initialLineupEditorState("a"));

  test("3. undo goes back to the base, and the place in the queue is the one before", () => {
    const both = run(toggle("a", SOFIA), toggle("a", DAVI));
    expect(both.drafts.a?.allocation.bench).toEqual([DAVI, SOFIA]);
    const one = lineupEditorReducer(both, toggle("a", DAVI));
    expect(one.drafts.a?.allocation.bench).toEqual([SOFIA]);
    expect(lineupEditorReducer(one, toggle("a", SOFIA)).drafts).toEqual({});
    const queueAfter = (state: typeof both) =>
      started({ lineups: savedLineupsOf({ a: state.drafts.a?.allocation ?? defaultOf("a") }) })
        .queue.players;
    expect(queueAfter(both)).toEqual([]);
    expect(queueAfter(one)).toEqual([DAVI]);
    expect(queueAfter(lineupEditorReducer(one, toggle("a", DAVI)))).toEqual([]);
  });

  test("4. the pool of Azul loses what Laranja benched; the row shows it checked", () => {
    const state = run(toggle("a", DAVI));
    expect(benchPoolOf(state, source(), "b")).toEqual([SOFIA]);
    const view = lineupView(state, source());
    expect(view.team?.benchRow?.label).toBe("Banco do Laranja");
    expect(view.team?.benchRow?.options.map(({ name, checked }) => [name, checked])).toEqual([
      ["Davi", true],
      ["Sofia", false],
    ]);
    expect(view.canSave).toBe(true);
  });

  test("4/5. a libero leaves the benches and is never toggled onto its own", () => {
    const withLibero = run({ type: "libero-chosen", base: baseOf("a"), memberId: SOFIA });
    expect(benchPoolOf(withLibero, source(), "a")).toEqual([DAVI]);
    expect(benchPoolOf(withLibero, source(), "b")).toEqual([DAVI]);
    expect(lineupEditorReducer(withLibero, toggle("a", SOFIA)).drafts).toEqual(withLibero.drafts);
  });

  test("9. no reserves: the row says so and has no chip", () => {
    const arrangement = g1UuidArrangement([TEAM_A, TEAM_B], []);
    const row = lineupView(initialLineupEditorState("a"), source({}, arrangement)).team?.benchRow;
    expect(row?.options).toEqual([]);
    expect(row?.note).toBe("Sem reservas para o banco.");
  });

  test("14. the reducer ignores the lineup and anyone outside the pool; a change clears the selection", () => {
    const base = baseOf("a");
    const pool = [DAVI, SOFIA];
    const selected = run({ type: "player-tapped", base, memberId: uuidOf(TEAM_A[0]) });
    expect(selected.selection).not.toBeNull();
    const toggled = (memberId: string) =>
      lineupEditorReducer(selected, { type: "bench-toggled", base, memberId, pool });
    expect(toggled(uuidOf(TEAM_A[1])).drafts).toEqual({});
    expect(toggled(uuidOf("rafa")).drafts).toEqual({});
    expect(toggled(DAVI).selection).toBeNull();
  });
});
