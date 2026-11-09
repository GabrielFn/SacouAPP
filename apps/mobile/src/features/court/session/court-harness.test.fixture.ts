import {
  INITIAL_COURT_SESSION_STATE,
  type CourtSessionState,
  type MatchStartedPayload,
  type TeamSide,
} from "@sacou/match-engine";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { createCourtEventRepository } from "../persistence/court-event-repository";
import { migrateDatabase } from "../persistence/migrations";
import {
  openNodeSqliteDatabase,
  type NodeSqliteDatabase,
} from "../persistence/node-sqlite-database.test.fixture";
import type { CourtEventLog } from "../ports/court-event-log";
import type { IdGenerator } from "../ports/id-generator";
import { createCourtReplayer, type CourtReplayer } from "./court-replay";
import {
  createCourtSessionController,
  type CourtSessionController,
} from "./court-session-controller";
import { startCourtMatch } from "./start-court-match";

export const COURT_SESSION_ID = "c0000000-0000-4000-8000-0000000000c1";

export type StorageKind = "memory" | "sqlite";

/** One court "device": a log, the ids and a replayer, from which controllers are opened and killed. */
export interface CourtHarness {
  readonly log: CourtEventLog;
  readonly ids: IdGenerator;
  readonly replayer: CourtReplayer;
  readonly sqlite: NodeSqliteDatabase | null;
  /** The next write fails as a full disk would, writing nothing. */
  failNextWrite(): void;
  /** A fresh controller over the same storage, as after the app was killed and reopened. */
  openController(options?: { ids?: IdGenerator }): CourtSessionController;
  start(input: MatchStartedPayload): ReturnType<typeof startCourtMatch>;
}

export async function createHarness(kind: StorageKind): Promise<CourtHarness> {
  const ids = createSequentialIdGenerator();
  const sqlite = kind === "sqlite" ? openNodeSqliteDatabase() : null;
  if (sqlite !== null) {
    await migrateDatabase(sqlite.database);
  }
  const memory = createFakeCourtEventLog(ids);
  const log = sqlite === null ? memory : createCourtEventRepository(sqlite.database, ids);
  const shared = createCourtReplayer();
  const deps = (override?: IdGenerator) => ({
    courtSessionId: COURT_SESSION_ID,
    log,
    replayer: shared,
    ids: override ?? ids,
  });
  return {
    log,
    ids,
    replayer: shared,
    sqlite,
    failNextWrite() {
      if (sqlite === null) {
        memory.failNextAppend();
      } else {
        sqlite.failOnRun(1);
      }
    },
    openController: (options) =>
      createCourtSessionController(deps(options?.ids)),
    start: (input) =>
      startCourtMatch(deps(), input),
  };
}

/** The state of the match: the replay of the events the controller shows, never a copy. */
export function stateOf(
  harness: CourtHarness,
  controller: CourtSessionController,
): CourtSessionState {
  const snapshot = controller.getSnapshot();
  if (snapshot.status !== "ready") {
    throw new Error(`controller is ${snapshot.status}`);
  }
  const timeline = harness.replayer.replay(COURT_SESSION_ID, snapshot.events);
  if (!timeline.ok) {
    throw new Error("the log does not replay");
  }
  const last = timeline.value.entries[timeline.value.entries.length - 1];
  return last === undefined ? INITIAL_COURT_SESSION_STATE : last.state;
}

/** Scores the points one after the other: each letter is the team that scores. */
export async function rallies(
  controller: CourtSessionController,
  teams: string,
): Promise<void> {
  for (const letter of teams) {
    const team: TeamSide = letter === "a" ? "a" : "b";
    const result = await controller.dispatch({ type: "score-point", team });
    if (!result.ok) {
      throw new Error(`point refused: ${result.error.code}`);
    }
  }
}
