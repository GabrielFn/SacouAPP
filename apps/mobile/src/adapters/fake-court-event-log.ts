import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok } from "@sacou/volley-rules";

import { continuesLog, highestSequence } from "../features/court/persistence/append-rules";
import { FIRST_BATCH } from "../features/court/persistence/migrations.data";
import type {
  CourtEventLog,
  CourtLogResult,
  CourtSessionOrigin,
} from "../features/court/ports/court-event-log";
import type { IdGenerator } from "../services/id/id-generator";

interface FakeSession {
  readonly status: "open" | "closed";
  readonly events: readonly EventEnvelope[];
  readonly origin: CourtSessionOrigin | null;
}

type FakeSessions = Readonly<Record<string, FakeSession>>;

/** The same contract as the SQLite log, in memory, for tests and previews. */
export interface FakeCourtEventLog extends CourtEventLog {
  /** The next `append` fails as a full disk would, writing nothing. */
  failNextAppend(): void;
}

export function createFakeCourtEventLog(ids: IdGenerator): FakeCourtEventLog {
  const sessions = { value: {} as FakeSessions };
  const device = { value: null as string | null };
  const fault = { value: false };

  function put(courtSessionId: string, session: FakeSession): void {
    sessions.value = { ...sessions.value, [courtSessionId]: session };
  }

  function append(
    courtSessionId: string,
    envelopes: readonly EventEnvelope[],
  ): CourtLogResult<void> {
    const session = sessions.value[courtSessionId];
    if (session === undefined) {
      return err({ code: "session-not-found" });
    }
    if (fault.value) {
      fault.value = false;
      return err({ code: "storage-failed" });
    }
    const lastSequence = highestSequence(session.events, envelopes[0]?.deviceId ?? "");
    if (!continuesLog(envelopes, { courtSessionId, batch: FIRST_BATCH, lastSequence })) {
      return err({ code: "sequence-conflict" });
    }
    put(courtSessionId, { ...session, events: [...session.events, ...envelopes] });
    return ok(undefined);
  }

  return {
    failNextAppend() {
      fault.value = true;
    },
    getDeviceId() {
      device.value ??= ids.newId();
      return Promise.resolve(ok(device.value));
    },
    openSession(courtSessionId, origin) {
      if (sessions.value[courtSessionId] === undefined) {
        put(courtSessionId, { status: "open", events: [], origin: origin ?? null });
      }
      return Promise.resolve(ok(undefined));
    },
    findActiveSession() {
      const open = Object.entries(sessions.value)
        .reverse()
        .find(([, session]) => session.status === "open");
      return Promise.resolve(ok(open?.[0] ?? null));
    },
    findSessionOrigin(courtSessionId) {
      return Promise.resolve(ok(sessions.value[courtSessionId]?.origin ?? null));
    },
    findOpenSessionOfRound(roundId) {
      const open = Object.entries(sessions.value)
        .reverse()
        .find(([, session]) => session.status === "open" && session.origin?.roundId === roundId);
      return Promise.resolve(ok(open?.[0] ?? null));
    },
    closeSession(courtSessionId) {
      const session = sessions.value[courtSessionId];
      if (session === undefined) {
        return Promise.resolve(err({ code: "session-not-found" }));
      }
      put(courtSessionId, { ...session, status: "closed" });
      return Promise.resolve(ok(undefined));
    },
    load(courtSessionId) {
      const session = sessions.value[courtSessionId];
      return Promise.resolve(
        session === undefined
          ? err({ code: "session-not-found" })
          : ok({ batch: FIRST_BATCH, events: session.events }),
      );
    },
    append: (courtSessionId, envelopes) => Promise.resolve(append(courtSessionId, envelopes)),
  };
}
