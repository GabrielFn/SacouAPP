import {
  getRecentPoints,
  previewRevert,
  parseEventEnvelope,
  undoLastAction,
  type CourtSessionTimeline,
  type EventEnvelope,
} from "@sacou/match-engine";

import { selectCourtScreen } from "../model/court-screen.selectors";
import type { Clock } from "../ports/clock";
import type { CourtRoster } from "../ports/court-roster";
import type { CourtRuntime } from "../ports/court-runtime";
import { createCourtReplayer, runCourtReplay } from "../session/court-replay";
import { createCourtSessionController } from "../session/court-session-controller";
import {
  BENCHMARK_LIMIT_TAPS,
  BENCHMARK_REPETITIONS,
  BENCHMARK_START_INDEX_CALLS,
  BENCHMARK_TAP_CYCLE as TAP_CYCLE,
  BENCHMARK_TAPS,
  BENCHMARK_WARMUPS,
} from "./benchmark.data";
import { stampEvents, type BenchmarkScenario } from "./benchmark-scenarios";
import { summarize, type Summary } from "./benchmark-stats";

export type BenchmarkStepId =
  "parse" | "replay" | "screen" | "corrections" | "load" | "reopen" | "tap";

export interface BenchmarkStep {
  readonly id: BenchmarkStepId;
  readonly summary: Summary;
}

export interface BenchmarkResult {
  readonly scenario: BenchmarkScenario["id"];
  readonly events: number;
  readonly steps: readonly BenchmarkStep[];
}

export interface BenchmarkDeps {
  readonly clock: Clock;
  readonly roster: CourtRoster;
  /** The database of the benchmark, never the one of the matches. */
  readonly runtime: CourtRuntime;
  /** Gives the screen time to draw between two measures. */
  readonly pause: () => Promise<void>;
  readonly repetitions?: number;
  readonly warmups?: number;
}

interface StoredRow {
  readonly envelope: EventEnvelope;
  readonly payload: string;
}

function range(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/** Times `work` (the warm-ups are run and dropped): the milliseconds of each repetition. */
async function measure(deps: BenchmarkDeps, work: () => unknown): Promise<Summary> {
  const { clock, pause, repetitions = BENCHMARK_REPETITIONS, warmups = BENCHMARK_WARMUPS } = deps;
  const samples = { value: [] as readonly number[] };
  for (const round of range(warmups + repetitions)) {
    const started = clock.now();
    await work();
    const spent = clock.now() - started;
    samples.value = round < warmups ? samples.value : [...samples.value, spent];
    await pause();
  }
  return summarize(samples.value);
}

function toRows(events: readonly EventEnvelope[]): readonly StoredRow[] {
  return events.map((envelope) => ({ envelope, payload: JSON.stringify(envelope.payload) }));
}

/** (a) what the repository does with each row it reads: JSON and the parser of the envelope. */
function parseRows(rows: readonly StoredRow[]): void {
  rows.forEach(({ envelope, payload }) => {
    const parsed = parseEventEnvelope({ ...envelope, payload: JSON.parse(payload) as unknown });
    if (!parsed.ok) {
      throw new Error("the benchmark log does not parse");
    }
  });
}

function replayOrFail(
  scenario: BenchmarkScenario,
  events: readonly EventEnvelope[],
): CourtSessionTimeline {
  const replayed = runCourtReplay(scenario.courtSessionId, events);
  if (!replayed.ok) {
    throw new Error("the benchmark log does not replay");
  }
  return replayed.value;
}

/** The third newest point: the one a person picks to see what going back to it does. */
const BENCHMARK_PICKED_POINT = 2;

/**
 * (d) the work of the screen of corrections (screen 24: the list, and opening the preview of one point). `getOpenMatchStartIndex` is not public: it
 * runs inside `undoLastAction`, which the court asks for on every draw (`canUndo`), so it is asked 10 times.
 */
function askCorrections(timeline: CourtSessionTimeline): void {
  range(BENCHMARK_START_INDEX_CALLS).forEach(() => {
    undoLastAction(timeline);
  });
  const points = getRecentPoints(timeline);
  // Picking a line: the preview of going back runs for the picked point only (E4.10, D4).
  const picked = points[BENCHMARK_PICKED_POINT];
  if (picked !== undefined) {
    previewRevert(timeline, picked.eventId);
  }
}

async function storeScenario(
  { runtime }: BenchmarkDeps,
  scenario: BenchmarkScenario,
): Promise<string> {
  const courtSessionId = runtime.ids.newId();
  const device = await runtime.log.getDeviceId();
  const opened = await runtime.log.openSession(courtSessionId);
  if (!device.ok || !opened.ok) {
    throw new Error("the benchmark database cannot be opened");
  }
  const events = stampEvents(scenario.events, courtSessionId, device.value);
  const stored = await runtime.log.append(courtSessionId, events);
  if (!stored.ok) {
    throw new Error("the benchmark log cannot be stored");
  }
  return courtSessionId;
}

/** (e) a tap through the whole path: the command, the simulation, the write and the replay. */
async function timeTaps(
  deps: BenchmarkDeps,
  courtSessionId: string,
  taps: number,
): Promise<Summary> {
  const { runtime, clock, pause } = deps;
  const controller = createCourtSessionController({
    ...runtime,
    courtSessionId,
    replayer: createCourtReplayer(),
  });
  await controller.whenIdle();
  const samples = { value: [] as readonly number[] };
  for (const index of range(taps)) {
    const started = clock.now();
    const result = await controller.dispatch(
      index % TAP_CYCLE === 0 ? { type: "score-point", team: "a" } : { type: "undo" },
    );
    samples.value = [...samples.value, clock.now() - started];
    if (!result.ok) {
      throw new Error(`the benchmark tap was refused: ${JSON.stringify(result.error)}`);
    }
    await pause();
  }
  return summarize(samples.value);
}

/** (f) reading the rows, and opening the court again: reading them and replaying the log. */
async function measureSqlite(
  deps: BenchmarkDeps,
  scenario: BenchmarkScenario,
): Promise<readonly BenchmarkStep[]> {
  const { runtime } = deps;
  const courtSessionId = await storeScenario(deps, scenario);
  const load = await measure(deps, () => runtime.log.load(courtSessionId));
  const reopen = await measure(deps, async () => {
    const controller = createCourtSessionController({
      ...runtime,
      courtSessionId,
      replayer: createCourtReplayer(),
    });
    await controller.whenIdle();
    const snapshot = controller.getSnapshot();
    return snapshot.status === "ready" ? runCourtReplay(courtSessionId, snapshot.events) : null;
  });
  const taps = scenario.id === "S4" ? BENCHMARK_LIMIT_TAPS : BENCHMARK_TAPS;
  const tap = await timeTaps(deps, courtSessionId, taps);
  await runtime.log.closeSession(courtSessionId);
  return [
    { id: "load", summary: load },
    { id: "reopen", summary: reopen },
    { id: "tap", summary: tap },
  ];
}

/** One scenario, every step: (a) to (d) in memory and (e), (f) on the real SQLite. */
export async function runScenario(
  deps: BenchmarkDeps,
  scenario: BenchmarkScenario,
): Promise<BenchmarkResult> {
  const rows = toRows(scenario.events);
  const timeline = replayOrFail(scenario, scenario.events);
  const steps: readonly BenchmarkStep[] = [
    {
      id: "parse",
      summary: await measure(deps, () => {
        parseRows(rows);
      }),
    },
    {
      id: "replay",
      summary: await measure(deps, () => replayOrFail(scenario, [...scenario.events])),
    },
    { id: "screen", summary: await measure(deps, () => selectCourtScreen(timeline, deps.roster)) },
    {
      id: "corrections",
      summary: await measure(deps, () => {
        askCorrections(timeline);
      }),
    },
    ...(await measureSqlite(deps, scenario)),
  ];
  return { scenario: scenario.id, events: scenario.events.length, steps };
}
