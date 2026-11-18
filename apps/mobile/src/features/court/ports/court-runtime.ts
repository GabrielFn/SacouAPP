import type { Result } from "@sacou/volley-rules";

import type { CourtReplayer } from "../session/court-replay";
import type { CourtEventLog } from "./court-event-log";
import type { CourtSyncHooks } from "./court-sync";
import type { IdGenerator } from "../../../services/id/id-generator";

/** What the local database gives, already opened: the log, the replay cache and the ids. */
export interface CourtStorage {
  readonly log: CourtEventLog;
  readonly replayer: CourtReplayer;
  readonly ids: IdGenerator;
}

/** What the court needs from the device: the storage and the hooks of the upload (ADR 0067). */
export interface CourtRuntime extends CourtStorage {
  readonly sync: CourtSyncHooks;
}

export interface CourtRuntimeError {
  readonly code: "storage-failed" | "unsupported-database-version";
}

/** Opens the local database and migrates it; the app waits for it before showing the routes. */
export interface CourtRuntimeOpener {
  open(): Promise<Result<CourtStorage, CourtRuntimeError>>;
}
