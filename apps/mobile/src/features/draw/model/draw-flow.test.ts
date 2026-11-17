import { drawBalance } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { drawStrings } from "../../../strings/draw.pt-BR";
import type { DrawLock } from "./draw-arrangement";
import {
  drawFlowReducer,
  initialDrawFlowState,
  lockAcrossTeams,
  type DrawFlowAction,
  type DrawFlowState,
} from "./draw-flow.reducer";
import { MAX_DRAW_LOCKS } from "./draw-limits";
import { drawNamesOf } from "./draw-names";
import { drawRequest } from "./draw-request";
import { drawTitle, footerHint, lockButton, noticeText } from "./draw-view";
import { meterView } from "./draw-meter";
import { drawAnswer, drawnG1, g1Members, g1Round, G1_ANSWER, tap } from "./draw.test.fixture";
import { swapPlayers } from "./swap-players";

const nameOf = drawNamesOf(g1Members());

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !(value instanceof Map)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function lockMode(state: DrawFlowState): DrawFlowState {
  return drawFlowReducer(state, { type: "lock-mode-chosen" });
}

function lockPair(state: DrawFlowState, first: string, second: string): DrawFlowState {
  return tap(lockMode(state), first, second);
}

describe("drawn: the answer of the server becomes the arrangement (G1)", () => {
  test("two teams of six, Davi and Sofia in the queue, nothing selected", () => {
    const state = drawnG1();
    expect(state.arrangement?.teams).toEqual([
      ["ana", "joao", "pedro", "lia", "marcos", "bia"],
      ["rafa", "duda", "caio", "nina", "leo", "gabi"],
    ]);
    expect(state.arrangement?.reserves).toEqual(["davi", "sofia"]);
    expect(state.selection).toBeNull();
    expect(state.arrangement === null ? "" : drawTitle(state.arrangement)).toBe(
      "2 times de 6 + 2 reservas",
    );
  });

  test("the meter of the TS matches the averages and the gap of the server", () => {
    const arrangement = drawnG1().arrangement;
    if (arrangement === null) throw new Error("drawn");
    const levels = arrangement.teams.map((team) =>
      team.map((memberId) => arrangement.levels.get(memberId) ?? 0),
    );
    expect(drawBalance(levels)).toEqual({
      ok: true,
      value: {
        averagesTenths: G1_ANSWER.teams.map((team) => team.averageTenths),
        differenceTenths: G1_ANSWER.differenceTenths,
      },
    });
    expect(meterView(arrangement)?.title).toBe("Diferença 0,1 · ótimo");
  });

  test("teams come back sorted by number, whatever the order of the answer", () => {
    const answer = { ...G1_ANSWER, teams: [...G1_ANSWER.teams].reverse() };
    expect(drawnG1(answer).arrangement?.teams[0]?.[0]).toBe("ana");
  });
});

describe("player-tapped in swap mode", () => {
  test("a first tap selects, the same tap clears", () => {
    expect(tap(drawnG1(), "duda").selection).toBe("duda");
    expect(tap(drawnG1(), "duda", "duda").selection).toBeNull();
  });

  test("Duda then Pedro swap teams, the selection clears and the meter moves", () => {
    const before = drawnG1();
    const after = tap(before, "duda", "pedro");
    expect(after.arrangement?.teams[0]).toContain("duda");
    expect(after.arrangement?.teams[1]).toContain("pedro");
    expect(after.selection).toBeNull();
    const meterOf = (state: DrawFlowState) =>
      state.arrangement === null ? null : meterView(state.arrangement)?.averages;
    // 225 - 45 + 35 = 215 (3,6) against 220 - 35 + 45 = 230 (3,8).
    expect(meterOf(after)).toBe("A 3,6 · B 3,8");
    expect(meterOf(before)).toBe("A 3,8 · B 3,7");
  });

  test("Duda with Sofia (reserve 2): Sofia plays, Duda is the reserve 2 and goes in the request", () => {
    const after = tap(drawnG1(), "duda", "sofia");
    expect(after.arrangement?.teams[1]?.[1]).toBe("sofia");
    expect(after.arrangement?.reserves).toEqual(["davi", "duda"]);
    const body = drawRequest(after, g1Round());
    expect(body).toEqual({ ok: true, value: { locks: [], reserves: ["davi", "duda"] } });
  });

  test("two of the same team change nothing but the selection", () => {
    const before = drawnG1();
    const after = tap(before, "ana", "pedro");
    expect(after.arrangement).toBe(before.arrangement);
    expect(after.selection).toBeNull();
  });

  test("swapping a locked member takes its lock away, with a notice", () => {
    const locked = lockPair(drawnG1(), "ana", "joao");
    expect(locked.locks).toEqual([{ first: "ana", second: "joao" }]);
    const after = tap(locked, "ana", "rafa");
    expect(after.locks).toEqual([]);
    expect(noticeText(after.notice, nameOf)).toBe("A trava de Ana e João saiu.");
  });

  test("a tap on someone not in the draw is ignored", () => {
    const state = drawnG1();
    expect(tap(state, "ghost")).toBe(state);
    expect(tap(initialDrawFlowState, "ana")).toBe(initialDrawFlowState);
  });
});

describe("player-tapped in lock mode", () => {
  test("two of the same team lock without a new draw", () => {
    const before = lockMode(drawnG1());
    const after = tap(before, "duda", "rafa");
    expect(after.locks).toEqual([{ first: "duda", second: "rafa" }]);
    expect(lockAcrossTeams(tap(before, "duda"), after)).toBeNull();
    expect(after.mode).toBe("swap");
  });

  test("two of different teams lock and ask for a new draw with the lock", () => {
    const selected = tap(lockMode(drawnG1()), "duda");
    const after = tap(selected, "pedro");
    expect(lockAcrossTeams(selected, after)).toEqual({ first: "duda", second: "pedro" });
    expect(drawRequest(after, g1Round())).toEqual({
      ok: true,
      value: {
        locks: [{ first: "duda", second: "pedro", kind: "together" }],
        reserves: ["davi", "sofia"],
      },
    });
  });

  test("a reserve never locks", () => {
    const after = lockPair(drawnG1(), "duda", "davi");
    expect(after.locks).toEqual([]);
    expect(noticeText(after.notice, nameOf)).toBe(drawStrings.notice.reserveCannotLock);
  });

  test("the same pair twice, in any order, is one lock", () => {
    const once = lockPair(drawnG1(), "duda", "rafa");
    expect(lockPair(once, "rafa", "duda").locks).toHaveLength(1);
  });

  test("the 25th lock is refused in the app with a text", () => {
    const locks: readonly DrawLock[] = Array.from({ length: MAX_DRAW_LOCKS }, (_, index) => ({
      first: `x${String(index)}`,
      second: `y${String(index)}`,
    }));
    const full = { ...drawnG1(), locks };
    const after = lockPair(full, "duda", "rafa");
    expect(after.locks).toHaveLength(MAX_DRAW_LOCKS);
    expect(noticeText(after.notice, nameOf)).toBe("Dá para travar até 24 duplas.");
    expect(drawRequest({ ...full, locks: [...locks, locks[0] ?? { first: "", second: "" }] }, g1Round()).ok).toBe(false);
  });

  test("selecting a locked member turns the button into Destravar, which takes all its locks", () => {
    const locked = lockPair(lockPair(drawnG1(), "ana", "joao"), "ana", "lia");
    const selected = tap(locked, "ana");
    expect(lockButton(selected)).toBe("unlock");
    expect(lockButton(tap(locked, "pedro"))).toBe("lock");
    const unlocked = drawFlowReducer(selected, { type: "unlock-chosen" });
    expect(unlocked.locks).toEqual([]);
    expect(unlocked.selection).toBeNull();
  });

  test("a refused lock across teams goes back out", () => {
    const after = lockPair(drawnG1(), "duda", "pedro");
    const undone = drawFlowReducer(after, {
      type: "lock-undone",
      lock: { first: "pedro", second: "duda" },
    });
    expect(undone.locks).toEqual([]);
  });

  test("a new draw drops the locks that came apart", () => {
    const locked = lockPair(drawnG1(), "duda", "rafa");
    const redrawn = drawFlowReducer(locked, {
      type: "drawn",
      answer: drawAnswer(
        [
          ["ana", "joao", "pedro", "lia", "marcos", "duda"],
          ["rafa", "bia", "caio", "nina", "leo", "gabi"],
        ],
        ["davi", "sofia"],
      ),
    });
    expect(redrawn.locks).toEqual([]);
  });
});

describe("the hint over the footer", () => {
  test.each([
    [[], "swap", "Toque num nome pra trocar."],
    [["duda"], "swap", "Você selecionou Duda. Toque em outro nome pra trocar."],
    [["duda"], "lock", "Toque no parceiro de Duda pra travar."],
  ] as const)("selection %j in %s mode", (taps, mode, hint) => {
    const base = mode === "lock" ? lockMode(drawnG1()) : drawnG1();
    expect(footerHint(tap(base, ...taps), nameOf)).toBe(hint);
  });
});

describe("the reducer is pure and exhaustive", () => {
  test("an action without a case does not compile", () => {
    // @ts-expect-error: "unknown-action" is not a DrawFlowAction.
    const action: DrawFlowAction = { type: "unknown-action" };
    expect(action.type).toBe("unknown-action");
  });

  test("a swap never changes the arrangement it came from", () => {
    const state = deepFreeze(drawnG1());
    const arrangement = state.arrangement;
    if (arrangement === null) throw new Error("drawn");
    const before = JSON.stringify(arrangement.teams);
    const swapped = swapPlayers(arrangement, "duda", "pedro");
    expect(JSON.stringify(arrangement.teams)).toBe(before);
    expect(swapped).not.toBe(arrangement);
    expect(() => tap(state, "duda", "sofia")).not.toThrow();
  });
});
