import { describe, expect, test } from "vitest";

import { ApiFailure } from "../../../services/api/api-error";
import type { GroupRole } from "../../../services/api/sacou-api";
import { canDraw } from "./can-draw";
import { arrangementOf, type DrawArrangement } from "./draw-arrangement";
import { meterAxis, meterLabel, meterView } from "./draw-meter";
import { drawNamesOf } from "./draw-names";
import { staleDraw } from "./draw-request";
import {
  drawScreenState,
  shouldDrawFirst,
  type DrawScreenInput,
} from "./draw-screen-state";
import { drawShareText } from "./draw-share-text";
import { drawTitle, reserveChips, teamCards } from "./draw-view";
import {
  drawAnswer,
  drawnG1,
  drawSettings,
  g1Members,
  g1Round,
  G1_ANSWER,
  G1_ORDER,
  tap,
} from "./draw.test.fixture";

const nameOf = drawNamesOf(g1Members());
const g1 = arrangementOf(G1_ANSWER);

function problem(status: number, code: string): ApiFailure {
  return new ApiFailure({ kind: "problem", status, code } as never);
}

function input(patch: Partial<DrawScreenInput> = {}, role: GroupRole = "admin"): DrawScreenInput {
  return {
    loaded: { role, round: g1Round(), settings: drawSettings() },
    arrangement: null,
    pending: false,
    error: null,
    online: true,
    ...patch,
  };
}

function withSettings(enabled: boolean): DrawScreenInput {
  return input({ loaded: { role: "admin", round: g1Round(), settings: drawSettings(enabled) } });
}

describe("the label and the axis of the meter (question 55, D5)", () => {
  test.each([
    [0, "great"],
    [2, "great"],
    [3, "good"],
    [5, "good"],
    [6, "unbalanced"],
  ] as const)("a gap of %s tenths is %s", (gap, label) => {
    expect(meterLabel(gap)).toBe(label);
  });

  test.each([
    [37, 38, 30, 40],
    [39, 41, 30, 50],
    [30, 40, 30, 40],
    [10, 50, 10, 50],
  ])("averages %s and %s give an axis from %s to %s", (low, high, from, to) => {
    expect(meterAxis(low, high)).toEqual({ fromTenths: from, toTenths: to });
  });

  test("the screen reader hears every average, with a comma", () => {
    expect(meterView(g1)?.accessibilityLabel).toBe("Média de nota: Laranja 3,8, Azul 3,7");
    expect(meterView(g1)?.axisStart).toBe("3,0");
    expect(meterView(g1)?.axisEnd).toBe("4,0");
  });

  test("with three teams the markers are only the highest and the lowest", () => {
    const three = arrangementOf(
      drawAnswer([["lia", "bia"], ["ana", "joao"], ["marcos", "leo"]], []),
    );
    const meter = meterView(three);
    expect(meter?.markers.map((marker) => marker.team.letter)).toEqual(["B", "C"]);
    expect(meter?.title).toBe("Diferença 1,0 · desequilibrado");
    expect(meter?.averages).toBe("B 4,0 · C 3,0");
  });
});

describe("the cards (D4)", () => {
  test("Laranja and Azul with their level, a locked and a selected name", () => {
    const state = tap({ ...drawnG1(), locks: [{ first: "ana", second: "joao" }] }, "duda");
    const [orange, blue] = teamCards(state, g1, nameOf);
    expect(orange?.team).toMatchObject({ letter: "A", name: "Laranja", color: "orange" });
    expect(orange?.level).toBe("nota 3,8");
    expect(orange?.players[0]).toMatchObject({
      label: "Ana",
      level: "4,0",
      locked: true,
      accessibilityLabel: "Ana, nota 4,0, travado",
    });
    expect(blue?.players[1]).toMatchObject({ label: "Duda", selected: true });
    expect(reserveChips(state, g1, nameOf).map((chip) => chip.label)).toEqual([
      "1 · Davi",
      "2 · Sofia",
    ]);
  });

  test("12 in 4x4 make three cards, the third neutral, no reserves", () => {
    const twelve = arrangementOf(
      drawAnswer(
        [G1_ORDER.slice(0, 4), G1_ORDER.slice(4, 8), G1_ORDER.slice(8, 12)],
        [],
      ),
    );
    const cards = teamCards(drawnG1(), twelve, nameOf);
    expect(cards.map((card) => card.team.name)).toEqual(["Laranja", "Azul", "Time 3"]);
    expect(cards[2]?.team.color).toBe("neutral");
    expect(drawTitle(twelve)).toBe("3 times de 4");
  });

  test("9 in 2x2 make four teams of two and one reserve", () => {
    const nine = arrangementOf(
      drawAnswer(
        [0, 2, 4, 6].map((start) => G1_ORDER.slice(start, start + 2)),
        G1_ORDER.slice(8, 9),
      ),
    );
    expect(drawTitle(nine)).toBe("4 times de 2 + 1 reserva");
  });

  test("two who share a first name are told apart; no nickname is Sem apelido", () => {
    const names = drawNamesOf([
      ...g1Members(),
      { ...g1Members()[0], memberId: "ana-c", nickname: "Ana Clara" } as never,
      { ...g1Members()[0], memberId: "nobody", nickname: null } as never,
    ]);
    expect(names("ana-c")).toBe("Ana C.");
    expect(names("nobody")).toBe("Sem apelido");
    expect(names("not-loaded")).toBe("Sem apelido");
  });
});

describe("the list changed after the draw (D4)", () => {
  test("someone left: named, and the draw is stale", () => {
    const round = g1Round(G1_ORDER.filter((memberId) => memberId !== "duda"));
    expect(staleDraw(g1, round)).toEqual({ left: ["duda"], arrived: 0 });
  });

  test("two confirmed after the draw", () => {
    expect(staleDraw(g1, g1Round([...G1_ORDER, "x1", "x2"]))).toEqual({ left: [], arrived: 2 });
  });

  test("the same list is not stale", () => {
    expect(staleDraw(g1, g1Round())).toEqual({ left: [], arrived: 0 });
  });
});

describe("the states of screen 07, one per row of D4", () => {
  test("3 confirmed: not enough, and the first draw never goes", () => {
    const three = input({
      loaded: { role: "admin", round: g1Round(G1_ORDER.slice(0, 3)), settings: drawSettings() },
    });
    expect(drawScreenState(three)).toEqual({ kind: "blocked", blocker: "not-enough" });
    expect(shouldDrawFirst(three)).toBe(false);
  });

  test("draw turned off: disabled, never asked", () => {
    expect(drawScreenState(withSettings(false))).toEqual({ kind: "blocked", blocker: "disabled" });
    expect(shouldDrawFirst(withSettings(false))).toBe(false);
  });

  test("no network at the opening: offline, never asked; back online it asks", () => {
    expect(drawScreenState(input({ online: false }))).toEqual({ kind: "offline" });
    expect(shouldDrawFirst(input({ online: false }))).toBe(false);
    expect(shouldDrawFirst(input())).toBe(true);
  });

  test("a canceled round has no actions to give", () => {
    const canceled = input({
      loaded: { role: "admin", round: g1Round(G1_ORDER, { status: "canceled" }), settings: drawSettings() },
    });
    expect(drawScreenState(canceled)).toEqual({ kind: "blocked", blocker: "canceled" });
  });

  test.each(["scorekeeper", "player"] as const)("a %s is forbidden and never asks", (role) => {
    expect(drawScreenState(input({}, role))).toEqual({ kind: "blocked", blocker: "forbidden" });
    expect(shouldDrawFirst(input({}, role))).toBe(false);
  });

  test("a 403 is forbidden even after the draw", () => {
    const after = input({ arrangement: g1, error: problem(403, "groups.forbidden") });
    expect(drawScreenState(after)).toEqual({ kind: "blocked", blocker: "forbidden" });
  });

  test("the server's codes block like the cache would", () => {
    expect(drawScreenState(input({ error: problem(409, "sessions.round-closed") }))).toEqual({
      kind: "blocked",
      blocker: "canceled",
    });
    expect(
      drawScreenState(input({ error: problem(400, "sessions.draw-not-enough-players") })),
    ).toEqual({ kind: "blocked", blocker: "not-enough" });
  });

  test("a redraw refused for a lock keeps the teams", () => {
    const refused = input({ arrangement: g1, error: problem(400, "sessions.draw-locks-unsatisfiable") });
    expect(drawScreenState(refused)).toEqual({ kind: "drawn", arrangement: g1 });
  });

  test("waiting for the first draw, then drawn; redrawing keeps the teams", () => {
    expect(drawScreenState(input({ pending: true }))).toEqual({ kind: "drawing" });
    expect(drawScreenState(input({ arrangement: g1, pending: true })).kind).toBe("drawn");
    expect(drawScreenState(input({ arrangement: g1, online: false })).kind).toBe("drawn");
  });

  test("still loading the queries, or a failed first draw", () => {
    expect(drawScreenState(input({ loaded: null }))).toEqual({ kind: "loading" });
    const failed = problem(404, "sessions.round-not-found");
    expect(drawScreenState(input({ error: failed }))).toEqual({ kind: "failed", error: failed });
    expect(shouldDrawFirst(input({ error: failed }))).toBe(false);
  });

  test("unreadable settings never draw", () => {
    const unreadable = input({ loaded: { role: "admin", round: g1Round(), settings: null } });
    expect(drawScreenState(unreadable)).toEqual({ kind: "unreadable" });
  });
});

describe("canDraw (D1)", () => {
  test.each([
    ["admin", true],
    ["coAdmin", true],
    ["scorekeeper", false],
    ["player", false],
  ] as const)("%s draws: %s", (role, can) => {
    expect(canDraw(role)).toBe(can);
  });
});

describe("the shared text (D11, golden)", () => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}/i;
  const LEVEL = /\d,\d/;

  test("the exact text of G1: names only", () => {
    expect(drawShareText("Racha de terça", g1Round(), g1, nameOf)).toBe(
      [
        "Racha de terça · Ter 3/11",
        "Laranja: Ana, João, Pedro, Lia, Marcos, Bia",
        "Azul: Rafa, Duda, Caio, Nina, Léo, Gabi",
        "Reservas: 1 Davi, 2 Sofia",
      ].join("\n"),
    );
  });

  test("never a level, an ID nor a position, even with real IDs", () => {
    const realIds = arrangementOf({
      ...G1_ANSWER,
      teams: G1_ANSWER.teams.map((team) => ({
        ...team,
        members: team.members.map((member, index) => ({
          ...member,
          memberId: `8a4c2f0e-${String(index)}${String(team.number)}00-4c3b-9d2e-000000000001`,
        })),
      })),
    });
    const text = drawShareText("Racha", g1Round(), realIds, nameOf);
    expect(text).not.toMatch(UUID);
    expect(text).not.toMatch(LEVEL);
    expect(text).not.toMatch(/levantador|ponteiro|central|oposto|líbero/i);
  });

  test("without reserves there is no reserves line", () => {
    const noReserves: DrawArrangement = { ...g1, reserves: [] };
    expect(drawShareText("Racha", g1Round(), noReserves, nameOf)).not.toContain("Reservas");
  });
});
