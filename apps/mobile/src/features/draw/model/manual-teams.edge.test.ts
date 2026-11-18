import { describe, expect, test } from "vitest";

import { drawFlowReducer, initialDrawFlowState, type DrawFlowState } from "./draw-flow.reducer";
import { G1_ORDER, RESERVES, TEAM_A, TEAM_B, g1Round, tap } from "./draw.test.fixture";
import { arrivalArrangement } from "./manual-teams";
import { goingOf } from "../../rounds/model/attendance.test.fixture";

function kept(): DrawFlowState {
  const arrangement = arrivalArrangement(g1Round(), "indoor-6x6");
  if (arrangement === null) throw new Error("G1 has 14 confirmed");
  return drawFlowReducer(initialDrawFlowState, { type: "teams-built", arrangement });
}

describe("Montar times: arrival order and swaps (edges)", () => {
  test("positions out of order and with gaps still fill by position", () => {
    const going = [...G1_ORDER].reverse().map((id, index) => goingOf(id, 100 - index * 3));
    const round = g1Round(G1_ORDER, { going });
    const arrangement = arrivalArrangement(round, "indoor-6x6");
    expect(arrangement?.teams).toEqual([TEAM_A, TEAM_B]);
    expect(arrangement?.reserves).toEqual(RESERVES);
  });

  test("does not mutate the round going list", () => {
    const round = g1Round();
    const before = round.going.map((entry) => entry.memberId);
    arrivalArrangement(round, "indoor-6x6");
    expect(round.going.map((entry) => entry.memberId)).toEqual(before);
  });

  test("swap across the two teams exchanges the places", () => {
    const next = tap(kept(), "ana", "rafa");
    expect(next.arrangement?.teams[0]?.[0]).toBe("rafa");
    expect(next.arrangement?.teams[1]?.[0]).toBe("ana");
    expect(next.selection).toBeNull();
  });

  test("swap inside one team changes nothing but the selection", () => {
    const base = kept();
    const next = tap(base, "ana", "joao");
    expect(next.arrangement?.teams).toEqual(base.arrangement?.teams);
    expect(next.selection).toBeNull();
  });

  test("two reserves swapping keeps teams intact", () => {
    const next = tap(kept(), "davi", "sofia");
    expect(next.arrangement?.teams).toEqual([TEAM_A, TEAM_B]);
    expect([...(next.arrangement?.reserves ?? [])].sort()).toEqual(["davi", "sofia"]);
  });

  test("tapping a member outside the arrangement is ignored", () => {
    const base = kept();
    expect(tap(base, "ghost")).toBe(base);
    const selected = tap(base, "ana");
    expect(tap(selected, "ghost")).toBe(selected);
  });

  test("tapping the same name twice clears the selection", () => {
    expect(tap(kept(), "ana", "ana").selection).toBeNull();
  });

  test("tap before teams-built does nothing", () => {
    expect(tap(initialDrawFlowState, "ana")).toBe(initialDrawFlowState);
  });

  test("a swap in a team then reset then built again returns to arrival order", () => {
    const swapped = tap(kept(), "ana", "rafa");
    const reset = drawFlowReducer(swapped, { type: "teams-reset" });
    const arrangement = arrivalArrangement(g1Round(), "indoor-6x6");
    if (arrangement === null) throw new Error("unreachable");
    const rebuilt = drawFlowReducer(reset, { type: "teams-built", arrangement });
    expect(rebuilt.arrangement?.teams).toEqual([TEAM_A, TEAM_B]);
  });

  test("teams-built with an open selection and kept teams is a no-op (same reference)", () => {
    const selected = tap(kept(), "ana");
    const arrangement = arrivalArrangement(g1Round(), "indoor-6x6");
    if (arrangement === null) throw new Error("unreachable");
    expect(drawFlowReducer(selected, { type: "teams-built", arrangement })).toBe(selected);
  });

  test("teams-reset drops locks, notice and selection", () => {
    const locked = drawFlowReducer(kept(), { type: "lock-mode-chosen" });
    const pair = tap(locked, "ana", "joao");
    const reset = drawFlowReducer(pair, { type: "teams-reset" });
    expect(reset.locks).toEqual([]);
    expect(reset.selection).toBeNull();
    expect(reset.notice).toBeNull();
  });

  test("exactly 4 and 5 confirmed in 6x6: two teams of 2 and of 2 plus a reserve", () => {
    const four = arrivalArrangement(g1Round(G1_ORDER.slice(0, 4)), "indoor-6x6");
    expect(four?.teams.map((team) => team.length)).toEqual([2, 2]);
    expect(four?.reserves).toEqual([]);
    const five = arrivalArrangement(g1Round(G1_ORDER.slice(0, 5)), "indoor-6x6");
    expect(five?.teams.map((team) => team.length)).toEqual([2, 2]);
    expect(five?.reserves).toEqual([G1_ORDER[4]]);
  });

  test("nobody confirmed builds nothing", () => {
    expect(arrivalArrangement(g1Round([]), "indoor-6x6")).toBeNull();
  });
});
