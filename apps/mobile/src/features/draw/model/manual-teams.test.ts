import { describe, expect, test } from "vitest";

import { ApiFailure } from "../../../services/api/api-error";
import { meterView } from "./draw-meter";
import { drawFlowReducer, initialDrawFlowState } from "./draw-flow.reducer";
import { drawNamesOf } from "./draw-names";
import { drawScreenState, type DrawScreenInput } from "./draw-screen-state";
import { reserveChips, teamCards } from "./draw-view";
import {
  drawSettings,
  g1Members,
  g1Round,
  G1_ORDER,
  RESERVES,
  TEAM_A,
  TEAM_B,
  tap,
} from "./draw.test.fixture";
import { arrivalArrangement, playersPerTeamOf } from "./manual-teams";
import { withLeaf } from "../../groups/model/settings-patch";
import { goingOf } from "../../rounds/model/attendance.test.fixture";

const nameOf = drawNamesOf(g1Members());
const drawOff = drawSettings(false);

function manualInput(patch: Partial<DrawScreenInput> = {}): DrawScreenInput {
  return {
    loaded: { role: "admin", round: g1Round(), settings: drawOff },
    arrangement: null,
    pending: false,
    error: null,
    online: true,
    ...patch,
  };
}

function built() {
  const arrangement = arrivalArrangement(g1Round(), "indoor-6x6");
  if (arrangement === null) throw new Error("G1 has 14 confirmed");
  return arrangement;
}

describe("arrivalArrangement (golden draw-split.json)", () => {
  test("G1: the first six, the next six, Davi and Sofia waiting; no level", () => {
    expect(built()).toEqual({ teams: [TEAM_A, TEAM_B], reserves: RESERVES, levels: new Map() });
  });

  test("follows the position of arrival, not the order of the list", () => {
    const shuffled = g1Round(G1_ORDER, {
      going: [...G1_ORDER]
        .reverse()
        .map((memberId, index) => goingOf(memberId, G1_ORDER.length - index)),
    });
    expect(arrivalArrangement(shuffled, "indoor-6x6")?.teams[0]).toEqual(TEAM_A);
  });

  test.each([
    ["indoor-6x6", 2, 6, 2],
    ["beach-4x4", 3, 4, 2],
    ["beach-2x2", 7, 2, 0],
  ] as const)("%s: %s teams of %s, %s reserves", (modality, teams, size, reserves) => {
    const arrangement = arrivalArrangement(g1Round(), modality);
    expect(arrangement?.teams.length).toBe(teams);
    expect(arrangement?.teams.every((team) => team.length === size)).toBe(true);
    expect(arrangement?.reserves.length).toBe(reserves);
    expect(playersPerTeamOf(modality)).toBe(size);
  });

  test("10 in 6x6 make two teams of five (question 53)", () => {
    const ten = arrivalArrangement(g1Round(G1_ORDER.slice(0, 10)), "indoor-6x6");
    expect(ten?.teams.map((team) => team.length)).toEqual([5, 5]);
  });

  test("3 confirmed build nothing", () => {
    expect(arrivalArrangement(g1Round(G1_ORDER.slice(0, 3)), "indoor-6x6")).toBeNull();
  });
});

describe("screen 07 with the draw off", () => {
  test("shows the teams by arrival, offline too", () => {
    const expected = { kind: "drawn", arrangement: built(), manual: true };
    expect(drawScreenState(manualInput())).toEqual(expected);
    expect(drawScreenState(manualInput({ online: false }))).toEqual(expected);
  });

  test("a late confirmation joins the reserves until the first edit", () => {
    const fifteen = g1Round([...G1_ORDER, "new"]);
    const state = drawScreenState(
      manualInput({ loaded: { role: "admin", round: fifteen, settings: drawOff } }),
    );
    expect(state.kind === "drawn" && state.arrangement.reserves).toEqual([...RESERVES, "new"]);
  });

  test("after the first edit, the kept teams are shown", () => {
    const kept = tap(
      drawFlowReducer(initialDrawFlowState, { type: "teams-built", arrangement: built() }),
      "ana",
      "rafa",
    );
    const state = drawScreenState(manualInput({ arrangement: kept.arrangement }));
    expect(state.kind === "drawn" && state.arrangement.teams[0]?.[0]).toBe("rafa");
  });

  test("a refusal of the server no longer stops it", () => {
    const error = new ApiFailure({ kind: "problem", status: 409, code: "sessions.draw-disabled" });
    expect(drawScreenState(manualInput({ error })).kind).toBe("drawn");
  });

  test.each([
    ["a player", { role: "player" as const }, "forbidden"],
    ["3 confirmed", { round: g1Round(G1_ORDER.slice(0, 3)) }, "not-enough"],
    ["a canceled round", { round: g1Round(G1_ORDER, { status: "canceled" }) }, "canceled"],
  ])("%s still blocks", (_name, patch, blocker) => {
    const loaded = { role: "admin" as const, round: g1Round(), settings: drawOff, ...patch };
    expect(drawScreenState(manualInput({ loaded }))).toEqual({ kind: "blocked", blocker });
  });

  test("a draw turned on again asks the server", () => {
    const on = withLeaf(drawOff, "draw.enabled", true);
    const loaded = { role: "admin" as const, round: g1Round(), settings: on };
    expect(drawScreenState(manualInput({ loaded }))).toEqual({ kind: "loading" });
  });
});

describe("the teams by hand show no note and no meter", () => {
  const state = drawFlowReducer(initialDrawFlowState, {
    type: "teams-built",
    arrangement: built(),
  });

  test("no meter", () => {
    expect(meterView(built())).toBeNull();
  });

  test("no level on the cards nor on the reserves, and the name alone for the screen reader", () => {
    const cards = teamCards(state, built(), nameOf);
    expect(cards.map((card) => card.level)).toEqual(["", ""]);
    const chips = [
      ...cards.flatMap((card) => card.players),
      ...reserveChips(state, built(), nameOf),
    ];
    expect(chips.every((chip) => chip.level === "")).toBe(true);
    expect(chips[0]?.accessibilityLabel).toBe("Ana");
  });
});

describe("the reducer of Montar times", () => {
  test("teams-built keeps the teams once; a second one changes nothing", () => {
    const kept = drawFlowReducer(initialDrawFlowState, {
      type: "teams-built",
      arrangement: built(),
    });
    const swapped = tap(kept, "ana", "davi");
    expect(drawFlowReducer(swapped, { type: "teams-built", arrangement: built() })).toBe(swapped);
  });

  test("Trocar moves a player to the queue in the place of who left it", () => {
    const kept = drawFlowReducer(initialDrawFlowState, {
      type: "teams-built",
      arrangement: built(),
    });
    const swapped = tap(kept, "ana", "davi");
    expect(swapped.arrangement?.teams[0]?.[0]).toBe("davi");
    expect(swapped.arrangement?.reserves).toEqual(["ana", "sofia"]);
  });

  test("teams-reset goes back to the order of arrival", () => {
    const kept = tap(
      drawFlowReducer(initialDrawFlowState, { type: "teams-built", arrangement: built() }),
      "ana",
      "davi",
    );
    const reset = drawFlowReducer(kept, { type: "teams-reset" });
    expect(reset.arrangement).toBeNull();
    expect(reset.selection).toBeNull();
  });
});
