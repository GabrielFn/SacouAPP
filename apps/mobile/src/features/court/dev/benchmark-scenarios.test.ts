import { describe, expect, test } from "vitest";

import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { runCourtReplay } from "../session/court-replay";
import { buildBenchmarkScenario, withUndos, type BenchmarkScenarioId } from "./benchmark-scenarios";

async function replayed(id: BenchmarkScenarioId) {
  const scenario = await buildBenchmarkScenario(id, createSequentialIdGenerator());
  const result = runCourtReplay(scenario.courtSessionId, scenario.events);
  if (!result.ok) throw new Error(`${id} does not replay`);
  return { scenario, state: stateOfTimeline(result.value) };
}

describe("the scenarios of the Hermes benchmark replay with the real engine", () => {
  test("S1: one open set of 25, about fifty events", async () => {
    const { scenario, state } = await replayed("S1");
    expect(scenario.events.length).toBeGreaterThanOrEqual(40);
    expect(scenario.events.length).toBeLessThanOrEqual(60);
    expect(state.currentMatch?.currentSet?.score).toEqual({ a: 20, b: 20 });
    expect(state.finishedMatches).toHaveLength(0);
  });

  test("S2: best of five, 2-2 in sets, the tie-break open, about 300 events with 20 undos", async () => {
    const { scenario, state } = await replayed("S2");
    expect(scenario.events.length).toBeGreaterThanOrEqual(230);
    expect(scenario.events.length).toBeLessThanOrEqual(350);
    expect(scenario.events.filter(({ type }) => type === "RevertedTo")).toHaveLength(20);
    expect(state.currentMatch?.setsWon).toEqual({ a: 2, b: 2 });
    expect(state.currentMatch?.currentSet?.score).toEqual({ a: 5, b: 5 });
  });

  test("S3: a typical round, 29 finished matches and one open, about 1.5 thousand events", async () => {
    const { scenario, state } = await replayed("S3");
    expect(scenario.events.length).toBeGreaterThanOrEqual(1300);
    expect(scenario.events.length).toBeLessThanOrEqual(1700);
    expect(state.finishedMatches).toHaveLength(29);
    expect(state.currentMatch).not.toBeNull();
  });

  test("S4: the limit, 199 finished matches and one open, about 10 thousand events", async () => {
    const { scenario, state } = await replayed("S4");
    expect(scenario.events.length).toBeGreaterThanOrEqual(8500);
    expect(scenario.events.length).toBeLessThanOrEqual(11500);
    expect(state.finishedMatches).toHaveLength(199);
    expect(scenario.events.map(({ sequence }) => sequence).at(-1)).toBe(scenario.events.length);
  });

  test("every event id of a scenario is different", async () => {
    const { scenario } = await replayed("S3");
    expect(new Set(scenario.events.map(({ eventId }) => eventId)).size).toBe(
      scenario.events.length,
    );
  });
});

describe("the undos of the long match", () => {
  test("each undo is followed by the same point again, 5 at most per set", () => {
    const script = withUndos("a".repeat(400));
    expect(Array.from(script).filter((token) => token === "u")).toHaveLength(5);
    expect(script).toContain("aua");
  });
});
