import { err, ok } from "@sacou/volley-rules";

import { createCourtEventRepository } from "../features/court/persistence/court-event-repository";
import { migrateDatabase } from "../features/court/persistence/migrations";
import type { CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import { createCourtReplayer } from "../features/court/session/court-replay";
import { expoCryptoIdGenerator } from "./expo-crypto-id-generator";
import { openExpoSqliteDatabase } from "./expo-sqlite-database";

const DATABASE_FILE = "sacou.db";

export const expoCourtRuntimeOpener: CourtRuntimeOpener = {
  async open() {
    try {
      const database = await openExpoSqliteDatabase(DATABASE_FILE);
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
