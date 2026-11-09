import { ok } from "@sacou/volley-rules";

import type { CourtRuntime, CourtRuntimeOpener } from "../features/court/ports/court-runtime";
import { createCourtReplayer } from "../features/court/session/court-replay";
import { createFakeCourtEventLog } from "./fake-court-event-log";
import { createSequentialIdGenerator } from "./fake-sequential-id-generator";

export function createFakeCourtRuntime(): CourtRuntime {
  const ids = createSequentialIdGenerator();
  return { log: createFakeCourtEventLog(ids), replayer: createCourtReplayer(), ids };
}

/** The same runtime on every call, as the real file is one. */
export function createFakeCourtRuntimeOpener(
  runtime: CourtRuntime = createFakeCourtRuntime(),
): CourtRuntimeOpener {
  return { open: () => Promise.resolve(ok(runtime)) };
}
