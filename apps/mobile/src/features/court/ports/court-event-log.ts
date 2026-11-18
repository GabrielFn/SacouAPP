import type { EventEnvelope } from "@sacou/match-engine";
import type { Result } from "@sacou/volley-rules";

export type CourtLogErrorCode =
  | "corrupted-log"
  | "sequence-conflict"
  | "session-not-found"
  | "storage-failed"
  /** Another phone writes the stream now: this one appends nothing more (E4.11, D2). */
  | "taken-over";

/** Carries only a code: a stored value or a database message could hold data. */
export interface CourtLogError {
  readonly code: CourtLogErrorCode;
}

export type CourtLogResult<T> = Result<T, CourtLogError>;

/** Why the upload of a session stopped for good, a closed list (ADR 0067, D4). Never a server text. */
export const SYNC_HALT_CODES = [
  "stream-diverged",
  "round-canceled",
  "event-refused",
  "no-permission",
  "not-found",
  "event-too-large",
  "client-bug",
] as const;

export type SyncHaltCode = (typeof SYNC_HALT_CODES)[number];

/**
 * The halts that opening the app again lifts (D4): the admin may give the permission back, and a
 * round the server did not know may show up. The others are a stream that will not change.
 */
export const HALTS_LIFTED_ON_OPEN = [
  "no-permission",
  "not-found",
] as const satisfies readonly SyncHaltCode[];

export interface StoredCourtLog {
  /** The write batch of this device in the stream (`eventos.md`). */
  readonly batch: number;
  readonly events: readonly EventEnvelope[];
  /** The highest sequence of this device the server confirmed in this batch; 0 before any. */
  readonly ackedSequence: number;
  /** The batch of the phone that took over the stream, or `null` while this one writes. */
  readonly takenOverBatch: number | null;
  readonly syncHalt: SyncHaltCode | null;
  /** The session came from a round: the sample sessions have no origin and are never sent. */
  readonly fromRound: boolean;
  /** The key of the account that opened it (a hash, D8), or `null` when it was opened without one. */
  readonly ownerKey: string | null;
  /** The events of this device the server left out (D6), in the order of the log; never sent. */
  readonly refused: readonly EventEnvelope[];
  /** Screen 09c was not closed with "Entendi" since they left the log. */
  readonly refusedUnseen: boolean;
}

/**
 * Where a court session comes from: the round and the group, only IDs (D8, dados-pessoais.md). The
 * sample sessions of the development screen have none.
 */
export interface CourtSessionOrigin {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * A round session as it is opened: its origin and the key of the account signed in (a hash, never the
 * UID, ADR 0067, D8), or `null` when there was none: that session is then never sent.
 */
export interface OpenedCourtSession extends CourtSessionOrigin {
  readonly ownerKey?: string | null;
}

/** A session with events of this device the server has not confirmed yet (ADR 0067, D3). */
export interface SessionToSync extends CourtSessionOrigin {
  readonly courtSessionId: string;
  readonly ownerKey: string | null;
}

/** What the server said when another phone writes the stream (ADR 0067, D4). */
export interface TakeOverNotice {
  readonly currentBatch: number;
  /** The highest sequence of this device the server kept; the ones above it leave the log. */
  readonly lastStoredSequence: number;
}

/**
 * A stream read from the server after taking the court over (D5), already parsed and replayed: it
 * replaces the local log of the session, and this device writes the batch the server gave it.
 */
export interface ServerStreamImport {
  readonly courtSessionId: string;
  /** The round, and the key of the account that took the court over (never the UID). */
  readonly origin: CourtSessionOrigin & { readonly ownerKey: string };
  readonly deviceId: string;
  readonly events: readonly EventEnvelope[];
  readonly batch: number;
  /** The highest sequence of this device the server holds: the cursor of the upload. */
  readonly lastSequence: number;
}

/** The persisted log of the court sessions of this device: the one source of the match state. */
export interface CourtEventLog {
  /** A random UUID created on the first call and kept; never tied to hardware. */
  getDeviceId(): Promise<CourtLogResult<string>>;
  /** Idempotent: opening a session that exists changes nothing, and the origin is kept from its creation. */
  openSession(courtSessionId: string, origin?: OpenedCourtSession): Promise<CourtLogResult<void>>;
  /** Where the session came from, or `null` for a sample session without one (E4.10, D7). */
  findOrigin(courtSessionId: string): Promise<CourtLogResult<CourtSessionOrigin | null>>;
  /** The open session of the device, or `null`. */
  findActiveSession(): Promise<CourtLogResult<string | null>>;
  /** The open session that came from this round, or `null`. */
  findOpenSessionOfRound(roundId: string): Promise<CourtLogResult<string | null>>;
  closeSession(courtSessionId: string): Promise<CourtLogResult<void>>;
  /** Events by position. A row the parser refuses fails the whole load. */
  load(courtSessionId: string): Promise<CourtLogResult<StoredCourtLog>>;
  /**
   * All or nothing. The first sequence must follow the last one of the device in the stream; a session
   * taken over refuses with `taken-over`, in the same transaction as the write.
   */
  append(
    courtSessionId: string,
    envelopes: readonly EventEnvelope[],
  ): Promise<CourtLogResult<void>>;
  /**
   * The sessions with an origin, still sending (no halt, not taken over), that have events of this
   * device above the confirmed cursor, open or closed (closing never stops the upload).
   */
  findSessionsToSync(deviceId: string): Promise<CourtLogResult<readonly SessionToSync[]>>;
  /** Moves the cursor up to `sequence`; a lower one is ignored, so a late answer never moves it down. */
  markAcknowledged(courtSessionId: string, sequence: number): Promise<CourtLogResult<void>>;
  /** Only for the `sequence-gap` of the server, that lost events it had confirmed: sets the cursor. */
  rewindAcknowledged(courtSessionId: string, sequence: number): Promise<CourtLogResult<void>>;
  haltSync(courtSessionId: string, code: SyncHaltCode): Promise<CourtLogResult<void>>;
  /**
   * In one transaction: the events of this device above `lastStoredSequence` move to the refused ones,
   * the cursor goes to `lastStoredSequence` and the session is marked as taken over.
   */
  markTakenOver(
    courtSessionId: string,
    deviceId: string,
    notice: TakeOverNotice,
  ): Promise<CourtLogResult<void>>;
  /**
   * In one transaction (D5): the events of this device the server does not hold, in any open session
   * of the round, leave for the refused ones; the other open sessions of the round are closed; the
   * session gets exactly `events`, the batch and the cursor of the server, and writes again.
   */
  replaceWithServerStream(stream: ServerStreamImport): Promise<CourtLogResult<void>>;
  /** "Entendi" on screen 09c: the refused events stay, only no longer shown (D6). */
  markRefusedSeen(courtSessionId: string): Promise<CourtLogResult<void>>;
}
