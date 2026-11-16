import type { EventEnvelope, MatchStartedPayload, TeamSide } from "@sacou/match-engine";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import type { IdGenerator } from "../../../services/id/id-generator";
import { createCourtReplayer } from "../session/court-replay";
import { createCourtSessionController } from "../session/court-session-controller";
import { startCourtMatch } from "../session/start-court-match";
import {
  BENCHMARK_SESSION_ID,
  FINISHED_MATCH_RALLIES,
  LIMIT_FINISHED_MATCHES,
  LONG_MATCH_SETS,
  OPEN_MATCH_RALLIES,
  TYPICAL_ROUND_FINISHED_MATCHES,
  UNDO_PER_SET,
  UNDO_EVERY_POINTS,
} from "./benchmark.data";
import { relabelEvents } from "./relabel-events";
import {
  SAMPLE_MATCH_BEST_OF_THREE,
  SAMPLE_MATCH_ID,
  SAMPLE_MATCH_ONE_SET,
  SAMPLE_SCORING_BEST_OF_THREE,
} from "./sample-match.data";

export type BenchmarkScenarioId = "S1" | "S2" | "S3" | "S4";

export interface BenchmarkScenario {
  readonly id: BenchmarkScenarioId;
  readonly courtSessionId: string;
  /** The log, in order, ready to replay. */
  readonly events: readonly EventEnvelope[];
}

const BEST_OF_FIVE: MatchStartedPayload = {
  ...SAMPLE_MATCH_BEST_OF_THREE,
  scoring: { ...SAMPLE_SCORING_BEST_OF_THREE, bestOf: 5 },
};

/** Tokens: `a` or `b` scores, `u` undoes, `c` confirms a set, `A` confirms it with Laranja serving next. */
export type ScriptToken = "a" | "b" | "u" | "c" | "A";

/** After the n-th point of the list, one undo and the same point again, up to `UNDO_PER_SET` times. */
export function withUndos(rallies: string): string {
  const undone = { value: 0 };
  return Array.from(rallies)
    .map((point, index) => {
      const due = (index + 1) % UNDO_EVERY_POINTS === 0 && undone.value < UNDO_PER_SET;
      undone.value += due ? 1 : 0;
      return due ? `${point}u${point}` : point;
    })
    .join("");
}

async function play(
  controller: ReturnType<typeof createCourtSessionController>,
  script: string,
): Promise<void> {
  for (const token of script) {
    const result = await controller.dispatch(commandOf(token as ScriptToken));
    if (!result.ok) {
      throw new Error(`benchmark script refused ${token}: ${JSON.stringify(result.error)}`);
    }
  }
}

function commandOf(token: ScriptToken) {
  switch (token) {
    case "a":
    case "b":
      return { type: "score-point", team: token satisfies TeamSide } as const;
    case "u":
      return { type: "undo" } as const;
    case "c":
      return { type: "confirm-set-end" } as const;
    case "A":
      return { type: "confirm-set-end", firstServer: "a" } as const;
  }
}

/** A match played through the public commands of the engine, on a log in memory. */
async function playMatch(
  input: MatchStartedPayload,
  script: string,
  ids: IdGenerator,
): Promise<readonly EventEnvelope[]> {
  const courtSessionId = BENCHMARK_SESSION_ID;
  const log = createFakeCourtEventLog(ids);
  const deps = { courtSessionId, log, replayer: createCourtReplayer(), ids };
  const started = await startCourtMatch(deps, input);
  if (!started.ok) {
    throw new Error(`benchmark match refused: ${started.error.code}`);
  }
  const controller = createCourtSessionController(deps);
  await controller.whenIdle();
  await play(controller, script);
  const loaded = await log.load(courtSessionId);
  if (!loaded.ok) {
    throw new Error("benchmark log cannot be read");
  }
  return loaded.value.events;
}

/** The same match played again and again: each copy has its own match id and its own event ids. */
function repeatMatch(
  block: readonly EventEnvelope[],
  copies: number,
  firstMatchNumber: number,
  ids: IdGenerator,
): readonly EventEnvelope[] {
  return Array.from({ length: copies }, (_, copy) =>
    relabelEvents(block, { from: SAMPLE_MATCH_ID, matchNumber: firstMatchNumber + copy, ids }),
  ).flat();
}

async function crowdedScenario(
  id: BenchmarkScenarioId,
  finishedMatches: number,
  ids: IdGenerator,
): Promise<BenchmarkScenario> {
  const finished = await playMatch(SAMPLE_MATCH_ONE_SET, `${FINISHED_MATCH_RALLIES}c`, ids);
  const open = await playMatch(SAMPLE_MATCH_ONE_SET, OPEN_MATCH_RALLIES, ids);
  const events = [
    ...repeatMatch(finished, finishedMatches, 1, ids),
    ...relabelEvents(open, { from: SAMPLE_MATCH_ID, matchNumber: finishedMatches + 1, ids }),
  ];
  return scenario(id, events);
}

function scenario(id: BenchmarkScenarioId, events: readonly EventEnvelope[]): BenchmarkScenario {
  return { id, courtSessionId: BENCHMARK_SESSION_ID, events: renumbered(events) };
}

/** Sequences run 1..n over the whole log and one device wrote it all, as in a real log. */
function renumbered(events: readonly EventEnvelope[]): readonly EventEnvelope[] {
  const deviceId = events[0]?.deviceId ?? "";
  return events.map((event, index) => ({ ...event, deviceId, sequence: index + 1 }));
}

/** The same events written by another device into another court session (the benchmark's own database). */
export function stampEvents(
  events: readonly EventEnvelope[],
  courtSessionId: string,
  deviceId: string,
): readonly EventEnvelope[] {
  return events.map((event) => ({ ...event, courtSessionId, deviceId }));
}

const LONG_MATCH_SCRIPT = [
  withUndos(LONG_MATCH_SETS.advantage),
  "c",
  withUndos(LONG_MATCH_SETS.azulWins),
  "c",
  withUndos(LONG_MATCH_SETS.orangeWins),
  "c",
  withUndos(LONG_MATCH_SETS.azulWinsClose),
  "A",
  LONG_MATCH_SETS.tieBreakOpen,
].join("");

/** S1 a set of 25 (about 50 events), S2 best of five (about 300), S3 a round (1.5 thousand), S4 the limit (10 thousand). */
export async function buildBenchmarkScenario(
  id: BenchmarkScenarioId,
  ids: IdGenerator,
): Promise<BenchmarkScenario> {
  switch (id) {
    case "S1":
      return scenario(id, await playMatch(SAMPLE_MATCH_ONE_SET, OPEN_MATCH_RALLIES, ids));
    case "S2":
      return scenario(id, await playMatch(BEST_OF_FIVE, LONG_MATCH_SCRIPT, ids));
    case "S3":
      return crowdedScenario(id, TYPICAL_ROUND_FINISHED_MATCHES, ids);
    case "S4":
      return crowdedScenario(id, LIMIT_FINISHED_MATCHES, ids);
  }
}
