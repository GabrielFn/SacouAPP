import { err, ok } from "@sacou/volley-rules";

import { createCourtEventRepository } from "../features/court/persistence/court-event-repository";
import { migrateDatabase } from "../features/court/persistence/migrations";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import { createCourtReplayer } from "../features/court/session/court-replay";
import { expoCryptoIdGenerator } from "./expo-crypto-id-generator";
import { openExpoSqliteDatabase } from "./expo-sqlite-database";

const DATABASE_FILE = "sacou.db";
/** The benchmark of the Hermes writes to a file of its own: the matches are never touched. */
const BENCHMARK_DATABASE_FILE = "sacou-benchmark.db";

function createExpoCourtRuntimeOpener(file: string): CourtRuntimeOpener {
  return {
    async open() {
      try {
        const database = await openExpoSqliteDatabase(file);
        const migrated = await migrateDatabase(database);
        if (!migrated.ok) {
          return err(migrated.error);
        }
        const ids = expoCryptoIdGenerator;
        return ok({
          log: createCourtEventRepository(database, ids),
          replayer: createCourtReplayer(),
          ids,
        });
      } catch {
        // The reason may carry a path or a message of the database: only the code is passed on.
        return err({ code: "storage-failed" });
      }
    },
  };
}

export const expoCourtRuntimeOpener = createExpoCourtRuntimeOpener(DATABASE_FILE);
export const expoBenchmarkRuntimeOpener = createExpoCourtRuntimeOpener(BENCHMARK_DATABASE_FILE);
