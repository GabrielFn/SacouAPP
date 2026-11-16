import type { IdGenerator } from "../../../services/id/id-generator";
import { buildBenchmarkScenario, type BenchmarkScenarioId } from "./benchmark-scenarios";
import { runScenario, type BenchmarkDeps, type BenchmarkResult } from "./replay-benchmark";

export const BENCHMARK_SCENARIO_IDS: readonly BenchmarkScenarioId[] = ["S1", "S2", "S3", "S4"];

export interface BenchmarkProgress {
  readonly scenario: BenchmarkScenarioId;
}

/** The four scenarios in order; `onProgress` says which one is next, before it starts. */
export async function runBenchmark(
  deps: BenchmarkDeps,
  ids: IdGenerator,
  onProgress: (progress: BenchmarkProgress) => void,
  onResult: (result: BenchmarkResult) => void,
): Promise<readonly BenchmarkResult[]> {
  const results = { value: [] as readonly BenchmarkResult[] };
  for (const id of BENCHMARK_SCENARIO_IDS) {
    onProgress({ scenario: id });
    await deps.pause();
    const result = await runScenario(deps, await buildBenchmarkScenario(id, ids));
    results.value = [...results.value, result];
    onResult(result);
  }
  return results.value;
}
