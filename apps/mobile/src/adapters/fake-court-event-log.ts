import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok } from "@sacou/volley-rules";

import { continuesLog } from "../features/court/persistence/append-rules";
import { FIRST_BATCH } from "../features/court/persistence/migrations.data";
import type {
  CourtEventLog,
  CourtLogResult,
} from "../features/court/ports/court-event-log";
import type { IdGenerator } from "../features/court/ports/id-generator";

interface FakeSession {
  readonly status: "open" | "closed";
  readonly events: readonly EventEnvelope[];
}

/** The same contract as the SQLite log, in memory, for tests and previews. */
export interface FakeCourtEventLog extends CourtEventLog {
  /** The next `append` fails as a full disk would, writing nothing. */
  failNextAppend(): void;
}

function highestSequence(events: readonly EventEnvelope[], deviceId: string): number {
  return events.reduce(
    (highest, event) => (event.deviceId === deviceId ? Math.max(highest, event.sequence) : highest),
    0,
  );
}

export function createFakeCourtEventLog(ids: IdGenerator): FakeCourtEventLog {
  const sessions = new Map<string, FakeSession>();
  const device = { id: null as string | null };
  const fault = { appendFails: false };

  function append(
    courtSessionId: string,
    envelopes: readonly EventEnvelope[],
  ): CourtLogResult<void> {
    const session = sessions.get(courtSessionId);
    if (session === undefined) {
      return err({ code: "session-not-found" });
    }
    if (fault.appendFails) {
      fault.appendFails = false;
      return err({ code: "storage-failed" });
    }
    const lastSequence = highestSequence(session.events, envelopes[0]?.deviceId ?? "");
    if (!continuesLog(envelopes, { courtSessionId, batch: FIRST_BATCH, lastSequence })) {
      return err({ code: "sequence-conflict" });
    }
    sessions.set(courtSessionId, { ...session, events: [...session.events, ...envelopes] });
    return ok(undefined);
  }

  return {
    failNextAppend() {
      fault.appendFails = true;
    },
    getDeviceId() {
      device.id ??= ids.newId();
      return Promise.resolve(ok(device.id));
    },
    openSession(courtSessionId) {
      if (!sessions.has(courtSessionId)) {
        sessions.set(courtSessionId, { status: "open", events: [] });
      }
      return Promise.resolve(ok(undefined));
    },
    findActiveSession() {
      const open = [...sessions].reverse().find(([, session]) => session.status === "open");
      return Promise.resolve(ok(open?.[0] ?? null));
    },
    closeSession(courtSessionId) {
      const session = sessions.get(courtSessionId);
      if (session === undefined) {
        return Promise.resolve(err({ code: "session-not-found" }));
      }
      sessions.set(courtSessionId, { ...session, status: "closed" });
      return Promise.resolve(ok(undefined));
    },
    load(courtSessionId) {
      const session = sessions.get(courtSessionId);
      return Promise.resolve(
        session === undefined
          ? err({ code: "session-not-found" })
          : ok({ batch: FIRST_BATCH, events: session.events }),
      );
    },
    append: (courtSessionId, envelopes) => Promise.resolve(append(courtSessionId, envelopes)),
  };
}
