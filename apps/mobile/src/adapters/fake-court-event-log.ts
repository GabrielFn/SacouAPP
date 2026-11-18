import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok } from "@sacou/volley-rules";

import { continuesLog, highestSequence } from "../features/court/persistence/append-rules";
import { FIRST_BATCH } from "../features/court/persistence/migrations.data";
import type {
  CourtEventLog,
  CourtLogResult,
  CourtSessionOrigin,
  SessionToSync,
  SyncHaltCode,
} from "../features/court/ports/court-event-log";
import type { IdGenerator } from "../services/id/id-generator";

interface FakeSession {
  readonly status: "open" | "closed";
  readonly events: readonly EventEnvelope[];
  readonly origin: CourtSessionOrigin | null;
  readonly ownerKey: string | null;
  readonly ackedSequence: number;
  readonly takenOverBatch: number | null;
  readonly syncHalt: SyncHaltCode | null;
  readonly refused: readonly EventEnvelope[];
}

type FakeSessions = Readonly<Record<string, FakeSession>>;

/** The same contract as the SQLite log, in memory, for tests and previews. */
export interface FakeCourtEventLog extends CourtEventLog {
  /** The next `append` fails as a full disk would, writing nothing. */
  failNextAppend(): void;
  /** The events of this device the server left out (E4.11, D6), for the assertions. */
  refusedOf(courtSessionId: string): readonly EventEnvelope[];
}

const NOT_FOUND: CourtLogResult<never> = err({ code: "session-not-found" });

function hasPending(session: FakeSession, deviceId: string): boolean {
  return session.events.some(
    (event) =>
      event.deviceId === deviceId &&
      event.batch === FIRST_BATCH &&
      event.sequence > session.ackedSequence,
  );
}

function isSending(session: FakeSession): session is FakeSession & { origin: CourtSessionOrigin } {
  return session.origin !== null && session.syncHalt === null && session.takenOverBatch === null;
}

export function createFakeCourtEventLog(ids: IdGenerator): FakeCourtEventLog {
  const sessions = { value: {} as FakeSessions };
  const device = { value: null as string | null };
  const fault = { value: false };

  function put(courtSessionId: string, session: FakeSession): void {
    sessions.value = { ...sessions.value, [courtSessionId]: session };
  }

  function update(
    courtSessionId: string,
    change: (session: FakeSession) => FakeSession,
  ): Promise<CourtLogResult<void>> {
    const session = sessions.value[courtSessionId];
    if (session === undefined) return Promise.resolve(NOT_FOUND);
    put(courtSessionId, change(session));
    return Promise.resolve(ok(undefined));
  }

  function append(
    courtSessionId: string,
    envelopes: readonly EventEnvelope[],
  ): CourtLogResult<void> {
    const session = sessions.value[courtSessionId];
    if (session === undefined) {
      return NOT_FOUND;
    }
    if (session.takenOverBatch !== null) {
      return err({ code: "taken-over" });
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

  function sessionsToSync(deviceId: string): readonly SessionToSync[] {
    return Object.entries(sessions.value).flatMap(([courtSessionId, session]) =>
      isSending(session) && hasPending(session, deviceId)
        ? [{ courtSessionId, ...session.origin, ownerKey: session.ownerKey }]
        : [],
    );
  }

  return {
    failNextAppend() {
      fault.value = true;
    },
    refusedOf: (courtSessionId) => sessions.value[courtSessionId]?.refused ?? [],
    getDeviceId() {
      device.value ??= ids.newId();
      return Promise.resolve(ok(device.value));
    },
    openSession(courtSessionId, origin) {
      if (sessions.value[courtSessionId] === undefined) {
        put(courtSessionId, {
          status: "open",
          events: [],
          origin:
            origin === undefined ? null : { groupId: origin.groupId, roundId: origin.roundId },
          ownerKey: origin?.ownerKey ?? null,
          ackedSequence: 0,
          takenOverBatch: null,
          syncHalt: null,
          refused: [],
        });
      }
      return Promise.resolve(ok(undefined));
    },
    findActiveSession() {
      const open = Object.entries(sessions.value)
        .reverse()
        .find(([, session]) => session.status === "open");
      return Promise.resolve(ok(open?.[0] ?? null));
    },
    findOpenSessionOfRound(roundId) {
      const open = Object.entries(sessions.value)
        .reverse()
        .find(([, session]) => session.status === "open" && session.origin?.roundId === roundId);
      return Promise.resolve(ok(open?.[0] ?? null));
    },
    closeSession: (courtSessionId) =>
      update(courtSessionId, (session) => ({ ...session, status: "closed" })),
    load(courtSessionId) {
      const session = sessions.value[courtSessionId];
      return Promise.resolve(
        session === undefined
          ? NOT_FOUND
          : ok({
              batch: FIRST_BATCH,
              events: session.events,
              ackedSequence: session.ackedSequence,
              takenOverBatch: session.takenOverBatch,
              syncHalt: session.syncHalt,
              fromRound: session.origin !== null,
              ownerKey: session.ownerKey,
            }),
      );
    },
    append: (courtSessionId, envelopes) => Promise.resolve(append(courtSessionId, envelopes)),
    findSessionsToSync: (deviceId) => Promise.resolve(ok(sessionsToSync(deviceId))),
    markAcknowledged: (courtSessionId, sequence) =>
      update(courtSessionId, (session) => ({
        ...session,
        ackedSequence: Math.max(session.ackedSequence, sequence),
      })),
    rewindAcknowledged: (courtSessionId, sequence) =>
      update(courtSessionId, (session) => ({ ...session, ackedSequence: sequence })),
    haltSync: (courtSessionId, code) =>
      update(courtSessionId, (session) => ({ ...session, syncHalt: code })),
    markTakenOver: (courtSessionId, deviceId, { currentBatch, lastStoredSequence }) =>
      update(courtSessionId, (session) => {
        const leaves = (event: EventEnvelope) =>
          event.deviceId === deviceId && event.sequence > lastStoredSequence;
        return {
          ...session,
          events: session.events.filter((event) => !leaves(event)),
          refused: [...session.refused, ...session.events.filter(leaves)],
          ackedSequence: lastStoredSequence,
          takenOverBatch: currentBatch,
        };
      }),
  };
}
