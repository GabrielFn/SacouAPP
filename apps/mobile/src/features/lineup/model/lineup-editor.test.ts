import {
  getLineupBySlot,
  getServingPlayer,
  MIDDLE_BLOCKER_LINEUP_INDEXES,
  type TeamState,
} from "@sacou/match-engine";
import { ROTATION_SLOTS } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import {
  draftsToSave,
  initialLineupEditorState,
  isDraftStale,
  lineupEditorReducer,
  shownAllocation,
  type LineupEditorAction,
  type LineupEditorState,
} from "./lineup-editor.reducer";
import { reanchor, withLibero } from "./lineup-moves";
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

function run(...actions: readonly LineupEditorAction[]): LineupEditorState {
  return actions.reduce(lineupEditorReducer, initialLineupEditorState("a"));
}

function tap(memberId: string): LineupEditorAction {
  return { type: "player-tapped", base, memberId };
}

function viewOf(state: LineupEditorState, team: TeamState = CANVAS_TEAM) {
  return lineupView(state, sourceOf(teamSource("a", baseOf(team)), teamSource("b", null)));
}

describe("rotation selector: absolute, only the zone changes (D4)", () => {
  test.each(ROTATION_SLOTS.map((zone) => [zone]))("zone %i", (zone) => {
    const state = run({ type: "rotation-chosen", base, zone });
    const shown = shownAllocation(state, base);
    expect(shown.lineup).toEqual(CANVAS_TEAM.lineup);
    expect(shown.setterZone).toBe(zone);
    const server = viewOf(state).team?.chips.find((chip) => chip.isServer)?.memberId;
    expect(server).toBe(getServingPlayer(CANVAS_TEAM.lineup, zone));
  });

  test("the zone of the base again drops the draft, so Salvar is off", () => {
    const state = run(
      { type: "rotation-chosen", base, zone: 4 },
      { type: "rotation-chosen", base, zone: 2 },
    );
    expect(state.drafts).toEqual({});
    expect(viewOf(state).canSave).toBe(false);
  });

  test("a new server on the team that serves is said before Salvar", () => {
    const state = run({ type: "rotation-chosen", base, zone: 1 });
    expect(viewOf(state).team?.serverChange).toBe("Pedro passa a sacar.");
    expect(viewOf(state).canSave).toBe(true);
    expect(viewOf(run()).team?.serverChange).toBeNull();
  });
});

describe("reanchor: nobody moves, only who sets (D4)", () => {
  const cases = ROTATION_SLOTS.flatMap((zone) =>
    CANVAS_TEAM.lineup.map((memberId) => [zone, memberId] as const),
  );
  test.each(cases)("zone %i, new setter %s", (zone, memberId) => {
    const before = teamState(CANVAS_TEAM.lineup, zone);
    const after = reanchor(before, memberId);
    expect(getLineupBySlot(after.lineup, after.setterZone)).toEqual(
      getLineupBySlot(before.lineup, before.setterZone),
    );
    expect(after.lineup[0]).toBe(memberId);
    const slot = ROTATION_SLOTS[getLineupBySlot(before.lineup, zone).indexOf(memberId)];
    expect(after.setterZone).toBe(slot);
  });

  test("the setter itself: the same allocation and no button", () => {
    expect(reanchor(CANVAS_TEAM, "pedro")).toBe(CANVAS_TEAM);
    expect(viewOf(run(tap("pedro"))).team?.canMakeSetter).toBe(false);
    expect(viewOf(run(tap("ana"))).team?.canMakeSetter).toBe(true);
  });

  test("setter-chosen reanchors on the selection and clears it", () => {
    const state = run(tap("ana"), { type: "setter-chosen", base });
    expect(state.selection).toBeNull();
    expect(shownAllocation(state, base).lineup[0]).toBe("ana");
    expect(run({ type: "setter-chosen", base }).drafts).toEqual({});
  });

  test("the free system has no button nor rotation", () => {
    const free = teamState(CANVAS_TEAM.lineup, 1, "livre");
    const view = lineupView(
      run({ type: "player-tapped", base: baseOf(free), memberId: "ana" }),
      sourceOf(teamSource("a", baseOf(free)), teamSource("b", null)),
    );
    expect(view.team?.canMakeSetter).toBe(false);
    expect(view.team?.rotation).toBeNull();
    expect(view.team?.chips.some((chip) => chip.isSetter)).toBe(false);
  });
});

describe("swap by tap (D3)", () => {
  test("select, then another: the two indexes swap, zone kept, selection cleared", () => {
    const state = run(tap("ana"), tap("lia"));
    const shown = shownAllocation(state, base);
    expect(shown.lineup).toEqual(["pedro", "lia", "ana", "marcos", "bia", "joao"]);
    expect(shown.setterZone).toBe(2);
    expect(state.selection).toBeNull();
    expect(viewOf(state).team?.warning).toBeNull();
  });

  test("the same twice clears the selection", () => {
    expect(run(tap("ana"), tap("ana")).selection).toBeNull();
    expect(run(tap("ana")).selection).toBe("ana");
    expect(run(tap("ana"), { type: "selection-cleared" }).selection).toBeNull();
    expect(run(tap("ana"), { type: "tab-chosen", side: "b" }).selection).toBeNull();
  });

  test("swapping the setter with Ana makes Ana the setter, warned when not one", () => {
    const view = viewOf(run(tap("pedro"), tap("ana")));
    const ana = view.team?.chips.find((chip) => chip.memberId === "ana");
    expect(ana?.isSetter).toBe(true);
    expect(ana?.isMisplaced).toBe(true);
    expect(ana?.accessibilityLabel).toBe("Ana, posição 2, levantador, fora de ordem");
  });

  test("the frozen base is never changed", () => {
    run(tap("ana"), tap("lia"), {
      type: "roles-fixed",
      base,
      positionOf: positionsOf(CANVAS_POSITIONS),
    });
    expect(CANVAS_TEAM.lineup).toEqual(["pedro", "ana", "lia", "marcos", "bia", "joao"]);
  });

  test("Corrigir swaps Ana and Lia, keeps Pedro and the zone", () => {
    const state = run({ type: "roles-fixed", base, positionOf: positionsOf(CANVAS_POSITIONS) });
    const shown = shownAllocation(state, base);
    expect(shown.lineup).toEqual(["pedro", "lia", "ana", "marcos", "bia", "joao"]);
    expect(shown.setterZone).toBe(2);
  });

  test("the canvas labels", () => {
    const labels = viewOf(run()).team?.chips.map((chip) => chip.accessibilityLabel);
    expect(labels).toEqual([
      "Joao, posição 1, sacando",
      "Pedro, posição 2, levantador",
      "Ana, posição 3, fora de ordem",
      "Lia, posição 4, fora de ordem",
      "Marcos, posição 5",
      "Bia, posição 6",
    ]);
  });
});

describe("libero (D5)", () => {
  test("a reserve becomes the libero of the two middle blockers", () => {
    const state = run({ type: "libero-chosen", base, memberId: "sofia" });
    const shown = shownAllocation(state, base);
    expect(shown.libero).toEqual({
      memberId: "sofia",
      replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES,
    });
    expect(shown.bench).toEqual([]);
    expect(viewOf(state).team?.libero.options.map((option) => option.label)).toEqual([
      "Sem líbero",
      "Sofia",
      "Rafa",
    ]);
    expect(viewOf(state).team?.benchLine).toBe("Sem banco (7 jogadores)");
  });

  test("receiving, the libero takes the back row slot of the middle blocker", () => {
    const team = teamState(CANVAS_TEAM.lineup, 1);
    const state = run({ type: "libero-chosen", base: baseOf(team), memberId: "sofia" });
    const view = lineupView(
      state,
      sourceOf(teamSource("a", baseOf(team), { phase: "receiving" }), teamSource("b", null)),
    );
    const libero = view.team?.chips.find((chip) => chip.isLibero);
    expect(libero?.memberId).toBe("sofia");
    expect(libero?.slot).toBe(6);
    expect(libero?.accessibilityLabel).toBe("Sofia, líbero, troca na linha Líbero");
    expect(view.team?.order.map((cell) => cell.name)).not.toContain("Sofia");
  });

  test("a tap on the libero never selects it", () => {
    const state = run({ type: "libero-chosen", base, memberId: "sofia" }, tap("sofia"));
    expect(state.selection).toBeNull();
  });

  test("the same reserve is never the libero of both teams", () => {
    const baseB = baseOf(teamState(["b1", "b2", "b3", "b4", "b5", "b6"], 1), "b");
    const state = run(
      { type: "libero-chosen", base, memberId: "sofia" },
      { type: "tab-chosen", side: "b" },
    );
    const view = lineupView(state, sourceOf(teamSource("a", base), teamSource("b", baseB)));
    expect(view.team?.libero.options.map((option) => option.label)).toEqual(["Sem líbero", "Rafa"]);
  });

  test("4x2: only the note", () => {
    const view = viewOf(run(), teamState(CANVAS_TEAM.lineup, 1, "4x2"));
    expect(view.team?.libero).toEqual({
      label: "Líbero do Laranja",
      options: [],
      note: "Líbero só no 5x1 e no 6x2.",
    });
  });

  test("nobody to choose: the text of the host", () => {
    const view = lineupView(
      run(),
      sourceOf(
        teamSource("a", base, { liberoPool: [], noLiberoText: "Sem líbero: o time tem 6." }),
        teamSource("b", null),
      ),
    );
    expect(view.team?.libero.note).toBe("Sem líbero: o time tem 6.");
  });

  test("in a match, the libero who leaves goes to the end of the bench", () => {
    const team: TeamState = {
      ...CANVAS_TEAM,
      bench: ["duda"],
      libero: { memberId: "sofia", replacedIndexes: MIDDLE_BLOCKER_LINEUP_INDEXES },
    };
    expect(withLibero(team, "duda", "bench")).toMatchObject({
      bench: ["sofia"],
      libero: { memberId: "duda" },
    });
    expect(withLibero(team, null, "bench")).toMatchObject({
      bench: ["duda", "sofia"],
      libero: null,
    });
    expect(withLibero(team, "pedro", "bench")).toBe(team);
    expect(withLibero(team, null, "out")).toMatchObject({ bench: ["duda"], libero: null });
  });
});

describe("a base that moved (D3)", () => {
  test("the draft is ignored, told, and never saved", () => {
    const state = run(tap("ana"), tap("lia"));
    const moved = { ...base, key: "k2" };
    expect(isDraftStale(state, moved)).toBe(true);
    expect(isDraftStale(state, base)).toBe(false);
    expect(shownAllocation(state, moved)).toBe(CANVAS_TEAM);
    expect(draftsToSave(state, [moved])).toEqual({});
    expect(draftsToSave(state, [base])).toMatchObject({
      a: { lineup: ["pedro", "lia", "ana", "marcos", "bia", "joao"] },
    });
  });

  test("draft-discarded drops it", () => {
    expect(run(tap("ana"), tap("lia"), { type: "draft-discarded", side: "a" }).drafts).toEqual({});
  });

  test("a tab without rotation says so", () => {
    const view = viewOf(run({ type: "tab-chosen", side: "b" }));
    expect(view.team).toBeNull();
    expect(view.noRotation).toBe("Azul tem 5: sem rotação.");
  });

  test("the bench line of the canvas", () => {
    expect(viewOf(run()).team?.benchLine).toBe("Sem banco (6 jogadores)");
  });
});
