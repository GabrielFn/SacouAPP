import { strings } from "../../../strings/pt-BR";
import { BUDGET_REOPEN_MS, BUDGET_TAP_P95_MS } from "./benchmark.data";
import type { BenchmarkResult, BenchmarkStep, BenchmarkStepId } from "./replay-benchmark";

const DECIMALS = 1;

function ms(value: number): string {
  return value.toFixed(DECIMALS);
}

function stepLine({ id, summary }: BenchmarkStep): string {
  const { median, p95, max } = summary;
  return strings.court.benchmark.stepLine(
    strings.court.benchmark.steps[id],
    ms(median),
    ms(p95),
    ms(max),
  );
}

function stepOf(
  results: readonly BenchmarkResult[],
  scenario: BenchmarkResult["scenario"],
  id: BenchmarkStepId,
): BenchmarkStep["summary"] | null {
  const result = results.find((candidate) => candidate.scenario === scenario);
  return result?.steps.find((step) => step.id === id)?.summary ?? null;
}

/** The verdict against the budget of ADR 0038: the tap (p95) of S3 and reopening (median) S4. */
export function budgetLines(results: readonly BenchmarkResult[]): readonly string[] {
  const text = strings.court.benchmark;
  const tap = stepOf(results, "S3", "tap");
  const reopen = stepOf(results, "S4", "reopen");
  return [
    tap === null
      ? text.budgetMissing
      : text.budgetTap(ms(tap.p95), BUDGET_TAP_P95_MS, tap.p95 <= BUDGET_TAP_P95_MS),
    reopen === null
      ? text.budgetMissing
      : text.budgetReopen(ms(reopen.median), BUDGET_REOPEN_MS, reopen.median <= BUDGET_REOPEN_MS),
  ];
}

/** The text of the screen: plain lines that can be copied or photographed. */
export function formatReport(results: readonly BenchmarkResult[]): string {
  const blocks = results.map((result) =>
    [
      strings.court.benchmark.scenarioLine(result.scenario, result.events),
      ...result.steps.map(stepLine),
    ].join("\n"),
  );
  return [...blocks, ...budgetLines(results)].join("\n\n");
}
