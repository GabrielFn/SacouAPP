import { describe, expect, test } from "vitest";

import { withLeaf } from "../../groups/model/settings-patch";
import {
  drawFlowReducer,
  initialDrawFlowState,
  type DrawFlowAction,
  type DrawFlowState,
} from "./draw-flow.reducer";
import { drawnG1 } from "./draw.test.fixture";
import {
  canStart,
  firstServerOptions,
  matchNumber,
  pointsView,
  rotationView,
  setsView,
  startBlocker,
  tieBreakLine,
} from "./pre-game-selectors";
import { g1Input, g1UuidArrangement, g1UuidNames, preGameSettings } from "./pre-game.test.fixture";
import { POINTS_PER_SET_RANGE } from "./pre-game";

const nameOf = g1UuidNames();
const BASE_POINTS = 25;

function run(state: DrawFlowState, ...actions: readonly DrawFlowAction[]): DrawFlowState {
  return actions.reduce(drawFlowReducer, state);
}

const step = (delta: number, base = BASE_POINTS): DrawFlowAction => ({
  type: "points-stepped",
  delta,
  base,
});

describe("the sheet over screen 07 (D1, D6)", () => {
  test("opens over a draw and closes back to it with the arrangement intact", () => {
    const drawn = drawnG1();
    const opened = run(drawn, { type: "pre-game-opened" });
    expect(opened.sheet).toBe("pre-game");
    const closed = run(opened, { type: "pre-game-closed" });
    expect(closed.sheet).toBe("none");
    expect(closed.arrangement).toBe(drawn.arrangement);
  });

  test("never opens before the draw", () => {
    expect(run(initialDrawFlowState, { type: "pre-game-opened" }).sheet).toBe("none");
  });
});

describe("the base comes from the round, the reducer keeps only what differs (D3, D6)", () => {
  test("25 points, best of 3 and the tie-break to 15", () => {
    const input = g1Input();
    expect(pointsView(input)).toEqual({ value: 25, canLess: true, canMore: true });
    expect(setsView(input).selected).toBe(3);
    expect(setsView(input).options.map((option) => option.label)).toEqual([
      "1 set",
      "Melhor de 3",
      "Melhor de 5",
    ]);
    expect(tieBreakLine(input)).toBe("Tie-break: 15 pontos");
  });

  test("one set, or the tie-break off, has no tie-break line", () => {
    expect(tieBreakLine(g1Input({ bestOf: 1 }))).toBeNull();
    const off = preGameSettings((settings) => withLeaf(settings, "scoring.tieBreakEnabled", false));
    expect(tieBreakLine(g1Input({}, off))).toBeNull();
  });

  test("25 → 26 → 25 leaves no override", () => {
    const up = run(drawnG1(), step(1));
    expect(up.preGame.pointsPerSet).toBe(26);
    expect(run(up, step(-1)).preGame.pointsPerSet).toBeNull();
  });

  test("the minus is off at the minimum and the plus at the maximum of the catalog", () => {
    const atMin = run(drawnG1(), step(-1, POINTS_PER_SET_RANGE.min));
    expect(atMin.preGame.pointsPerSet).toBeNull();
    expect(pointsView(g1Input({ pointsPerSet: POINTS_PER_SET_RANGE.min }))).toMatchObject({
      canLess: false,
      canMore: true,
    });
    const atMax = run(drawnG1(), step(1, POINTS_PER_SET_RANGE.max));
    expect(atMax.preGame.pointsPerSet).toBeNull();
    expect(pointsView(g1Input({ pointsPerSet: POINTS_PER_SET_RANGE.max }))).toMatchObject({
      canLess: true,
      canMore: false,
    });
  });

  test("choosing the base again drops the override of sets and system", () => {
    const chosen = run(
      drawnG1(),
      { type: "best-of-chosen", bestOf: 5, base: 3 },
      { type: "system-chosen", side: "b", system: "6x2", base: "5x1" },
    );
    expect(chosen.preGame.bestOf).toBe(5);
    expect(chosen.preGame.systems).toEqual({ a: null, b: "6x2" });
    const back = run(
      chosen,
      { type: "best-of-chosen", bestOf: 3, base: 3 },
      { type: "system-chosen", side: "b", system: "5x1", base: "5x1" },
    );
    expect(back.preGame.bestOf).toBeNull();
    expect(back.preGame.systems).toEqual({ a: null, b: null });
  });
});

describe("who serves first (D6, D10)", () => {
  test("A by default; the coin giving B makes B", () => {
    expect(drawnG1().preGame.firstServer).toBe("a");
    expect(run(drawnG1(), { type: "first-server-chosen", side: "b" }).preGame.firstServer).toBe(
      "b",
    );
  });

  test("the label is who stands in zone 1, by the engine", () => {
    expect(firstServerOptions(g1Input(), nameOf).map((option) => option.label)).toEqual([
      "A · Pedro",
      "B · Gabi",
    ]);
  });

  test("a team without rotation is called by its name", () => {
    const off = preGameSettings((settings) => withLeaf(settings, "rotation.enabled", false));
    expect(firstServerOptions(g1Input({}, off), nameOf).map((option) => option.label)).toEqual([
      "A · Laranja",
      "B · Azul",
    ]);
  });
});

describe("the rotation of each team (D6, D9)", () => {
  test("the round without rotation has no section", () => {
    const off = preGameSettings((settings) => withLeaf(settings, "rotation.enabled", false));
    expect(rotationView(g1Input({}, off), nameOf)).toBeNull();
  });

  test("5x1: tabs, the four systems, the setter and the bench line", () => {
    const view = rotationView(g1Input(), nameOf);
    expect(view?.tabs.map((tab) => tab.label)).toEqual(["Laranja · 5x1", "Azul · 5x1"]);
    expect(view?.picker?.options.map((option) => option.label)).toEqual([
      "Livre",
      "4x2",
      "5x1",
      "6x2",
    ]);
    expect(view?.picker?.setterLine).toBe("Levantador do Laranja: Pedro, começa na posição 1");
    expect(view?.benchLine).toBe("Laranja tem 6, sem banco.");
  });

  test("6x2 names both setters; Livre has no fixed setter", () => {
    const azul = rotationView(
      g1Input({ rotationTab: "b", systems: { a: "livre", b: "6x2" } }),
      nameOf,
    );
    expect(azul?.picker?.setterLine).toBe("Levantadores: Gabi e Léo");
    const laranja = rotationView(g1Input({ systems: { a: "livre", b: null } }), nameOf);
    expect(laranja?.picker?.setterLine).toBe("Sem levantador fixo. Ana começa na posição 1.");
    expect(laranja?.tabs.map((tab) => tab.label)).toEqual(["Laranja · Livre", "Azul · 5x1"]);
  });

  test("a team of five (10 confirmed) has no picker and says so", () => {
    const arrangement = g1UuidArrangement(
      [
        ["ana", "joao", "pedro", "lia", "marcos"],
        ["rafa", "duda", "caio", "nina", "leo"],
      ],
      [],
    );
    const view = rotationView(g1Input({}, preGameSettings(), arrangement), nameOf);
    expect(view?.picker).toBeNull();
    expect(view?.benchLine).toBe("Laranja tem 5: sem rotação.");
    expect(view?.tabs.map((tab) => tab.label)).toEqual(["Laranja", "Azul"]);
  });

  test("never 6x0 nor Pro", () => {
    const labels = JSON.stringify(rotationView(g1Input(), nameOf));
    expect(labels).not.toContain("6x0");
    expect(labels).not.toContain("Pro");
  });
});

describe("Partida N and Começar partida (D6)", () => {
  const session = "c0000000-0000-4000-8000-0000000000c1";
  const standing = { batch: 1, takenOver: false, refusedUnseen: false, unsentPoints: 0 };

  test("no session: match 1; one finished: match 2", () => {
    expect(matchNumber(null)).toBe(1);
    expect(
      matchNumber({ courtSessionId: session, startedMatches: 1, openMatch: false, ...standing }),
    ).toBe(2);
    expect(
      canStart(0, { courtSessionId: session, startedMatches: 1, openMatch: false, ...standing }),
    ).toBe(true);
  });

  test("a match on, or someone who left, turns the button off", () => {
    expect(
      startBlocker(0, { courtSessionId: session, startedMatches: 1, openMatch: true, ...standing }),
    ).toBe("open-match");
    expect(startBlocker(1, null)).toBe("stale");
    expect(canStart(1, null)).toBe(false);
  });
});
