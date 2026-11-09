import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
import { createCourtReplayer, runCourtReplay, type CourtReplayer } from "./court-replay";
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
  /** How many replays really ran (the cache answers the others). */
  runs(): number;
  readonly sqlite: NodeSqliteDatabase | null;
  /** The next write fails as a full disk would, writing nothing. */
  failNextWrite(): void;
  /** A fresh controller over the same storage. */
  openController(options?: { ids?: IdGenerator }): CourtSessionController;
  /**
   * Kills the app: with SQLite the file is closed and opened again, with a new repository and a new
   * replayer, so nothing in memory survives. Then opens a controller, like a cold start.
   */
  restart(): Promise<CourtSessionController>;
  start(input: MatchStartedPayload): ReturnType<typeof startCourtMatch>;
}

interface Environment {
  readonly log: CourtEventLog;
  readonly sqlite: NodeSqliteDatabase | null;
  readonly replayer: CourtReplayer;
  readonly runs: { value: number };
}

export async function createHarness(kind: StorageKind): Promise<CourtHarness> {
  const ids = createSequentialIdGenerator();
  const memory = createFakeCourtEventLog(ids);
  const file = join(mkdtempSync(join(tmpdir(), "sacou-court-")), "court.db");

  async function openEnvironment(): Promise<Environment> {
    const runs = { value: 0 };
    const replayer = createCourtReplayer((id, events) => {
      runs.value += 1;
      return runCourtReplay(id, events);
    });
    if (kind === "memory") {
      return { log: memory, sqlite: null, replayer, runs };
    }
    const sqlite = openNodeSqliteDatabase(file);
    await migrateDatabase(sqlite.database);
    return { log: createCourtEventRepository(sqlite.database, ids), sqlite, replayer, runs };
  }

  const current = { value: await openEnvironment() };
  const deps = (override?: IdGenerator) => ({
    courtSessionId: COURT_SESSION_ID,
    log: current.value.log,
    replayer: current.value.replayer,
    ids: override ?? ids,
  });
  return {
    get log() {
      return current.value.log;
    },
    ids,
    get replayer() {
      return current.value.replayer;
    },
    runs: () => current.value.runs.value,
    get sqlite() {
      return current.value.sqlite;
    },
    failNextWrite() {
      if (current.value.sqlite === null) {
        memory.failNextAppend();
      } else {
        current.value.sqlite.failOnRun(1);
      }
    },
    openController: (options) => createCourtSessionController(deps(options?.ids)),
    async restart() {
      current.value.sqlite?.raw.close();
      current.value = await openEnvironment();
      const controller = createCourtSessionController(deps());
      await controller.whenIdle();
      return controller;
    },
    start: (input) => startCourtMatch(deps(), input),
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
export async function rallies(controller: CourtSessionController, teams: string): Promise<void> {
  for (const letter of teams) {
    const team: TeamSide = letter === "a" ? "a" : "b";
    const result = await controller.dispatch({ type: "score-point", team });
    if (!result.ok) {
      throw new Error(`point refused: ${result.error.code}`);
    }
  }
}
