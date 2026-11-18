import {
  getLineupBySlot,
  getServingPlayer,
  nextSetterZone,
  previousSetterZone,
  type MemberId,
} from "@sacou/match-engine";
import { ROTATION_SLOTS } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import {
  initialLineupEditorState,
  lineupEditorReducer,
  shownAllocation,
  type LineupEditorAction,
  type LineupEditorState,
} from "./lineup-editor.reducer";
import { lineupView } from "./lineup-selectors";
import {
  baseOf,
  CANVAS_POSITIONS,
  CANVAS_TEAM,
  positionsOf,
  sourceOf,
  teamSource,
  teamState,
} from "./lineup.test.fixture";

const base = baseOf(CANVAS_TEAM);
const positionOf = positionsOf(CANVAS_POSITIONS);

function run(...actions: readonly LineupEditorAction[]): LineupEditorState {
  return actions.reduce(lineupEditorReducer, initialLineupEditorState("a"));
}

function tap(memberId: string): LineupEditorAction {
  return { type: "player-tapped", base, memberId };
}

function shown(state: LineupEditorState) {
  return shownAllocation(state, base);
}

function viewOf(state: LineupEditorState) {
  return lineupView(state, sourceOf(teamSource("a", base), teamSource("b", null)));
}

function pairsOf(members: readonly MemberId[]) {
  return members.flatMap((first, index) =>
    members.slice(index + 1).map((second) => [first, second] as const),
  );
}

describe("swap of two players, every pair", () => {
  test.each(pairsOf(CANVAS_TEAM.lineup))("%s and %s", (first, second) => {
    const after = shown(run(tap(first), tap(second)));
    const before = getLineupBySlot(CANVAS_TEAM.lineup, CANVAS_TEAM.setterZone);
    const now = getLineupBySlot(after.lineup, after.setterZone);
    expect(now[before.indexOf(first)]).toBe(second);
    expect(now[before.indexOf(second)]).toBe(first);
    expect([...after.lineup].sort()).toEqual([...CANVAS_TEAM.lineup].sort());
    expect(after.setterZone).toBe(CANVAS_TEAM.setterZone);
  });

  test("swapping back is the base again, so Salvar is off", () => {
    const state = run(tap("ana"), tap("bia"), tap("bia"), tap("ana"));
    expect(state.drafts).toEqual({});
    expect(viewOf(state).canSave).toBe(false);
  });
});

describe("rotation forward and back follows the engine", () => {
  test.each(ROTATION_SLOTS.map((zone) => [zone]))("from zone %i", (zone) => {
    const team = teamState(CANVAS_TEAM.lineup, zone);
    const here = baseOf(team);
    const order = getLineupBySlot(team.lineup, zone);
    const forward = nextSetterZone(zone);
    const turnedState = lineupEditorReducer(initialLineupEditorState("a"), {
      type: "rotation-chosen",
      base: here,
      zone: forward,
    });
    const turned = shownAllocation(turnedState, here);
    const next = getLineupBySlot(turned.lineup, turned.setterZone);
    // Each member moves to the slot before (2 to 1, 1 to 6): who was on slot 1 ends on slot 6.
    expect(next).toEqual([...order.slice(1), order[0]]);
    expect(getServingPlayer(turned.lineup, turned.setterZone)).toBe(order[1]);
    const back = lineupEditorReducer(turnedState, {
      type: "rotation-chosen",
      base: here,
      zone: previousSetterZone(forward),
    });
    expect(back.drafts).toEqual({});
  });

  test("six turns forward come back to the start", () => {
    let zone = CANVAS_TEAM.setterZone;
    for (let turn = 0; turn < ROTATION_SLOTS.length; turn += 1) zone = nextSetterZone(zone);
    expect(zone).toBe(CANVAS_TEAM.setterZone);
  });
});

describe("Tornar levantador", () => {
  test.each(CANVAS_TEAM.lineup.slice(1).map((member) => [member]))("%s", (memberId) => {
    const state = run(tap(memberId), { type: "setter-chosen", base });
    const after = shown(state);
    expect(getLineupBySlot(after.lineup, after.setterZone)).toEqual(
      getLineupBySlot(CANVAS_TEAM.lineup, CANVAS_TEAM.setterZone),
    );
    const chips = viewOf(state).team?.chips ?? [];
    expect(chips.filter((chip) => chip.isSetter).map((chip) => chip.memberId)).toEqual([memberId]);
    expect(viewOf(state).canSave).toBe(true);
  });

  test("with the libero chosen, he stays", () => {
    const state = run({ type: "libero-chosen", base, memberId: "sofia" }, tap("bia"), {
      type: "setter-chosen",
      base,
    });
    expect(shown(state).libero?.memberId).toBe("sofia");
  });
});

describe("Corrigir leaves the setter and the rotation", () => {
  test.each(ROTATION_SLOTS.map((zone) => [zone]))("zone %i", (zone) => {
    const team = teamState(["pedro", "lia", "ana", "bia", "joao", "marcos"], zone);
    const here = baseOf(team);
    const state = lineupEditorReducer(initialLineupEditorState("a"), {
      type: "roles-fixed",
      base: here,
      positionOf,
    });
    const after = shownAllocation(state, here);
    expect(after.lineup[0]).toBe("pedro");
    expect(after.setterZone).toBe(zone);
    expect(getLineupBySlot(after.lineup, zone)[ROTATION_SLOTS.indexOf(zone)]).toBe("pedro");
  });

  test("with a libero chosen, the libero and the zone stay", () => {
    const state = run(
      { type: "libero-chosen", base, memberId: "sofia" },
      { type: "roles-fixed", base, positionOf },
    );
    expect(shown(state).libero?.memberId).toBe("sofia");
    expect(shown(state).setterZone).toBe(CANVAS_TEAM.setterZone);
    expect(shown(state).lineup[0]).toBe("pedro");
  });

  test("on an ordered team there is nothing to save", () => {
    const ordered = baseOf(teamState(["pedro", "lia", "ana", "marcos", "bia", "joao"], 2));
    const state = lineupEditorReducer(initialLineupEditorState("a"), {
      type: "roles-fixed",
      base: ordered,
      positionOf,
    });
    expect(state.drafts).toEqual({});
  });
});

describe("libero chosen and undone, leaving and coming back to the queue", () => {
  const choose = (memberId: string | null): LineupEditorAction => ({
    type: "libero-chosen",
    base,
    memberId,
  });

  test("chosen then undone is the base: no draft, Salvar off", () => {
    const state = run(choose("sofia"), choose(null));
    expect(state.drafts).toEqual({});
    expect(viewOf(state).canSave).toBe(false);
  });

  test("another libero replaces the first, who is free again to choose", () => {
    const state = run(choose("sofia"), choose("rafa"));
    expect(shown(state).libero?.memberId).toBe("rafa");
    expect(shown(state).bench).toEqual([]);
    expect(shown(state).lineup).toEqual(CANVAS_TEAM.lineup);
    expect(viewOf(state).team?.libero.options.map((option) => option.label)).toContain("Sofia");
  });

  test("a member of the lineup is never chosen", () => {
    expect(run(choose("ana")).drafts).toEqual({});
  });

  test("the libero is never a seat of the lineup nor on the bench", () => {
    const after = shown(run(choose("sofia")));
    expect(after.lineup).toEqual(CANVAS_TEAM.lineup);
    expect(after.lineup).not.toContain("sofia");
    expect(after.bench).not.toContain("sofia");
  });
});
