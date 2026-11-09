import type { BenchmarkScenarioId } from "./benchmark-scenarios";
import type { BenchmarkResult } from "./replay-benchmark";

export type BenchmarkScreenState =
  | { readonly status: "idle" }
  | {
      readonly status: "running";
      readonly scenario: BenchmarkScenarioId;
      readonly results: readonly BenchmarkResult[];
    }
  | { readonly status: "done"; readonly results: readonly BenchmarkResult[] }
  | { readonly status: "failed"; readonly results: readonly BenchmarkResult[] };

export type BenchmarkScreenAction =
  | { readonly type: "start" }
  | { readonly type: "scenario-started"; readonly scenario: BenchmarkScenarioId }
  | { readonly type: "scenario-finished"; readonly result: BenchmarkResult }
  | { readonly type: "finish" }
  | { readonly type: "fail" };

export const INITIAL_BENCHMARK_SCREEN: BenchmarkScreenState = { status: "idle" };

/** What has been measured so far, in any state. */
export function resultsOf(state: BenchmarkScreenState): readonly BenchmarkResult[] {
  return state.status === "idle" ? [] : state.results;
}

export function benchmarkScreenReducer(
  state: BenchmarkScreenState,
  action: BenchmarkScreenAction,
): BenchmarkScreenState {
  switch (action.type) {
    case "start":
      return state.status === "running"
        ? state
        : { status: "running", scenario: "S1", results: [] };
    case "scenario-started":
      return state.status === "running" ? { ...state, scenario: action.scenario } : state;
    case "scenario-finished":
      return state.status === "running"
        ? { ...state, results: [...state.results, action.result] }
        : state;
    case "finish":
      return state.status === "running" ? { status: "done", results: state.results } : state;
    case "fail":
      return { status: "failed", results: resultsOf(state) };
  }
}
