import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import {
  selectCourtPhase,
  selectCourtScreen,
  selectMatchEnd,
  selectSetEnd,
  stateOfTimeline,
} from "./court-screen.selectors";
import {
  ROSTER,
  confirmSet,
  score,
  screen09,
  screen10,
  startScenario,
  withScoring,
  type Scenario,
} from "./screen-scenarios.test.fixture";

function screenOf(scenario: Scenario) {
  const model = selectCourtScreen(scenario.timeline(), ROSTER);
  if (model === null) throw new Error("no court to show");
  return model;
}

function chipsOf(scenario: Scenario, side: "a" | "b") {
  return screenOf(scenario).teams[side].chips.map(({ name, zone, isServer, isSetter }) => ({
    name,
    zone,
    isServer,
    isSetter,
  }));
}

describe("screen 09 (Sol): second set at 18-15", () => {
  test("header, sets and the strip", async () => {
    const model = screenOf(await screen09());
    expect(model.setNumber).toBe(2);
    expect(model.dots).toEqual([{ winner: "a" }, { winner: null }]);
    expect(model.hint).toEqual({ kind: "positions" });
    expect(model.phase).toBe("playing");
    expect(model.canUndo).toBe(true);
  });

  test("Laranja: 18, serving, 5x1 rotation 2, João serves from 1 and Pedro is the setter in 2", async () => {
    const scenario = await screen09();
    const { a } = screenOf(scenario).teams;
    expect(a).toMatchObject({
      label: "Laranja",
      color: "orange",
      score: 18,
      isServing: true,
      rotation: { system: "5x1", setterZone: 2 },
      hasSetPoint: false,
      serverName: "João",
    });
    expect(chipsOf(scenario, "a")).toEqual([
      { name: "João", zone: 1, isServer: true, isSetter: false },
      { name: "Pedro", zone: 2, isServer: false, isSetter: true },
      { name: "Ana", zone: 3, isServer: false, isSetter: false },
      { name: "Lia", zone: 4, isServer: false, isSetter: false },
      { name: "Marcos", zone: 5, isServer: false, isSetter: false },
      { name: "Bia", zone: 6, isServer: false, isSetter: false },
    ]);
  });

  test("Azul: 15, receiving, 5x1 rotation 1, Gabi is the setter in 1 and nobody serves", async () => {
    const scenario = await screen09();
    const { b } = screenOf(scenario).teams;
    expect(b).toMatchObject({
      label: "Azul",
      color: "blue",
      score: 15,
      isServing: false,
      rotation: { system: "5x1", setterZone: 1 },
      serverName: null,
    });
    expect(chipsOf(scenario, "b")).toEqual([
      { name: "Gabi", zone: 1, isServer: false, isSetter: true },
      { name: "Rafa", zone: 2, isServer: false, isSetter: false },
      { name: "Caio", zone: 3, isServer: false, isSetter: false },
      { name: "Nina", zone: 4, isServer: false, isSetter: false },
      { name: "Duda", zone: 5, isServer: false, isSetter: false },
      { name: "Léo", zone: 6, isServer: false, isSetter: false },
    ]);
  });

  test("the queue is Davi and Sofia, a partial exit", async () => {
    const { queue } = screenOf(await screen09());
    expect(queue?.players.map(({ name }) => name)).toEqual(["Davi", "Sofia"]);
    expect(queue).toMatchObject({ teams: [], exit: "partial" });
  });
});

describe("screen 10 (Noite): set point at 24-21", () => {
  test("Laranja has set point with Pedro serving in rotation 1; Azul is in rotation 6", async () => {
    const scenario = await screen10();
    const model = screenOf(scenario);
    expect(model.teams.a).toMatchObject({
      score: 24,
      hasSetPoint: true,
      serverName: "Pedro",
      rotation: { system: "5x1", setterZone: 1 },
    });
    expect(model.teams.b).toMatchObject({
      score: 21,
      hasSetPoint: false,
      rotation: { system: "5x1", setterZone: 6 },
    });
    expect(model.hint).toEqual({ kind: "closes-set", side: "a" });
    expect(chipsOf(scenario, "b").find(({ isSetter }) => isSetter)).toMatchObject({
      name: "Gabi",
      zone: 6,
    });
    expect(model.dots).toEqual([]);
  });
});

describe("set point and the end of the set", () => {
  test("24-24 without advantage: both teams have set point and the strip says so", async () => {
    const scenario = await startScenario(
      withScoring({ bestOf: 1, pointsPerSet: 25, tieBreakPoints: null, winMargin: 1 }),
    );
    await score(scenario, "ab".repeat(24));
    const model = screenOf(scenario);
    expect([model.teams.a.hasSetPoint, model.teams.b.hasSetPoint]).toEqual([true, true]);
    expect(model.hint).toEqual({ kind: "next-point-closes" });
    expect(model.phase).toBe("playing");
  });

  test("25-23 decides the set and the end-of-set model says who won", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, `${"ab".repeat(23)}aa`);
    expect(selectCourtPhase(stateOfTimeline(scenario.timeline()))).toBe("set-decided");
    expect(selectSetEnd(scenario.timeline(), ROSTER)).toEqual({
      setNumber: 1,
      winnerLabel: "Laranja",
      scores: { a: { label: "Laranja", score: 25 }, b: { label: "Azul", score: 23 } },
      needsFirstServer: false,
    });
    expect(screenOf(scenario).phase).toBe("set-decided");
  });

  test("the model of the end of the set is null while the set is being played", async () => {
    const scenario = await screen09();
    expect(selectSetEnd(scenario.timeline(), ROSTER)).toBeNull();
  });

  test("the toss is asked only before the deciding set of a series", async () => {
    const scenario = await startScenario();
    await score(scenario, `${"b".repeat(22)}${"a".repeat(25)}`);
    expect(selectSetEnd(scenario.timeline(), ROSTER)?.needsFirstServer).toBe(false);
    await confirmSet(scenario);
    await score(scenario, `${"a".repeat(20)}${"b".repeat(25)}`);
    expect(selectSetEnd(scenario.timeline(), ROSTER)).toMatchObject({
      setNumber: 2,
      winnerLabel: "Azul",
      needsFirstServer: true,
    });
  });

  test("a series won two sets to none asks no toss", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    await score(scenario, "a".repeat(25));
    expect(selectSetEnd(scenario.timeline(), ROSTER)?.needsFirstServer).toBe(false);
  });
});

describe("the end of the match", () => {
  test("after the last confirmation there is no court, only the result", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, `${"ab".repeat(20)}${"a".repeat(5)}`);
    await confirmSet(scenario);
    expect(selectCourtPhase(stateOfTimeline(scenario.timeline()))).toBe("match-ended");
    expect(selectCourtScreen(scenario.timeline(), ROSTER)).toBeNull();
    expect(selectMatchEnd(scenario.timeline(), ROSTER)).toEqual({
      winnerLabel: "Laranja",
      sets: [{ setNumber: 1, a: 25, b: 20 }],
    });
  });

  test("with a match open there is no result", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    expect(selectMatchEnd(scenario.timeline(), ROSTER)).toBeNull();
  });
});

describe("rotation off and one set", () => {
  test("a team without rotation has no chips and no rotation line, but keeps the phase", async () => {
    const scenario = await startScenario({
      ...SAMPLE_MATCH_ONE_SET,
      rotations: { a: null, b: SAMPLE_MATCH_ONE_SET.rotations.b },
    });
    const { a, b } = screenOf(scenario).teams;
    expect(a).toMatchObject({ chips: [], rotation: null, isServing: true, serverName: null });
    expect(b.chips).toHaveLength(6);
  });

  test("a single set hides the dots", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    expect(screenOf(scenario).dots).toEqual([]);
  });

  test("nothing to undo right after the start", async () => {
    const scenario = await startScenario();
    expect(screenOf(scenario).canUndo).toBe(false);
    await score(scenario, "a");
    expect(screenOf(scenario).canUndo).toBe(true);
  });
});
