import { describe, expect, test } from "vitest";

import { createFakeClock } from "../../../adapters/fake-clock";
import { createFakeCourtRuntime } from "../../../adapters/fake-court-runtime-opener";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { budgetLines, formatReport } from "./benchmark-report";
import { buildBenchmarkScenario } from "./benchmark-scenarios";
import { summarize } from "./benchmark-stats";
import {
  benchmarkScreenReducer,
  INITIAL_BENCHMARK_SCREEN,
  resultsOf,
} from "./benchmark-screen.reducer";
import { createSampleRoster } from "./sample-roster";
import { runScenario, type BenchmarkDeps, type BenchmarkStepId } from "./replay-benchmark";

const ALL_STEPS: readonly BenchmarkStepId[] = [
  "parse",
  "replay",
  "screen",
  "corrections",
  "load",
  "reopen",
  "tap",
];

function depsFor(): BenchmarkDeps {
  const clock = createFakeClock();
  return {
    // Every reading of the clock is one tick later, so the samples are 1 ms each and countable.
    clock: {
      now: () => {
        clock.advance(1);
        return clock.now();
      },
    },
    roster: createSampleRoster(),
    runtime: createFakeCourtRuntime(),
    pause: () => Promise.resolve(),
    repetitions: 4,
    warmups: 1,
  };
}

describe("the statistics", () => {
  test("median, p95 and maximum of the samples", () => {
    const samples = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(summarize(samples)).toEqual({ median: 10, p95: 19, max: 20 });
  });

  test("one sample is all three, and no sample is zeros", () => {
    expect(summarize([7])).toEqual({ median: 7, p95: 7, max: 7 });
    expect(summarize([])).toEqual({ median: 0, p95: 0, max: 0 });
  });
});

describe("running a scenario", () => {
  test("S1 measures every step: parse, replay, screen, corrections, load, reopen and tap", async () => {
    const scenario = await buildBenchmarkScenario("S1", createSequentialIdGenerator());
    const result = await runScenario(depsFor(), scenario);
    expect(result.scenario).toBe("S1");
    expect(result.events).toBe(scenario.events.length);
    expect(result.steps.map(({ id }) => id)).toEqual(ALL_STEPS);
    result.steps.forEach(({ summary }) => {
      expect(summary.max).toBeGreaterThanOrEqual(summary.median);
    });
  });

  test("the taps of the benchmark leave the log where it was (a point and its undo)", async () => {
    const deps = depsFor();
    const scenario = await buildBenchmarkScenario("S1", createSequentialIdGenerator());
    await runScenario(deps, scenario);
    // The session of the run is closed at the end; the matches database is never touched.
    expect(await deps.runtime.log.findActiveSession()).toEqual({ ok: true, value: null });
  });
});

describe("the report", () => {
  test("a block per scenario with a line per step, and the budget at the end", async () => {
    const results = [await runScenario(depsFor(), await buildBenchmarkScenario("S1", createSequentialIdGenerator()))];
    const text = formatReport(results);
    expect(text).toContain("S1 · ");
    expect(text).toContain("(b) replay: mediana");
    expect(text).toContain("Orçamento: sem medida.");
  });

  test("the budget says inside or over, from the numbers", () => {
    const step = (id: BenchmarkStepId, value: number) => ({
      id,
      summary: { median: value, p95: value, max: value },
    });
    const within = budgetLines([
      { scenario: "S3", events: 1500, steps: [step("tap", 99)] },
      { scenario: "S4", events: 10000, steps: [step("reopen", 1000)] },
    ]);
    expect(within.join("\n")).toContain("dentro");
    const over = budgetLines([
      { scenario: "S3", events: 1500, steps: [step("tap", 101)] },
      { scenario: "S4", events: 10000, steps: [step("reopen", 1001)] },
    ]);
    expect(over.join("\n")).toContain("ESTOUROU");
  });
});

describe("the state of the screen", () => {
  const result = { scenario: "S1", events: 1, steps: [] } as const;

  test("start, a scenario at a time, then done with all the results", () => {
    const states = [
      { type: "start" },
      { type: "scenario-started", scenario: "S1" },
      { type: "scenario-finished", result },
      { type: "finish" },
    ] as const;
    const done = states.reduce(benchmarkScreenReducer, INITIAL_BENCHMARK_SCREEN);
    expect(done).toEqual({ status: "done", results: [result] });
  });

  test("a second start while running changes nothing", () => {
    const running = benchmarkScreenReducer(INITIAL_BENCHMARK_SCREEN, { type: "start" });
    expect(benchmarkScreenReducer(running, { type: "start" })).toBe(running);
  });

  test("a failure keeps what was measured", () => {
    const running = [{ type: "start" }, { type: "scenario-finished", result }] as const;
    const failed = benchmarkScreenReducer(
      running.reduce(benchmarkScreenReducer, INITIAL_BENCHMARK_SCREEN),
      { type: "fail" },
    );
    expect(failed.status).toBe("failed");
    expect(resultsOf(failed)).toEqual([result]);
  });
});
