import type { Result } from "@sacou/volley-rules";

import type { CourtReplayer } from "../session/court-replay";
import type { CourtEventLog } from "./court-event-log";
import type { IdGenerator } from "./id-generator";

/** What the court needs from the device, already opened: the log, the replay cache and the ids. */
export interface CourtRuntime {
  readonly log: CourtEventLog;
  readonly replayer: CourtReplayer;
  readonly ids: IdGenerator;
}

export interface CourtRuntimeError {
  readonly code: "storage-failed" | "unsupported-database-version";
}

/** Opens the local database and migrates it; the app waits for it before showing the routes. */
export interface CourtRuntimeOpener {
  open(): Promise<Result<CourtRuntime, CourtRuntimeError>>;
}
