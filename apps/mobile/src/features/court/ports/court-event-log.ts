import type { EventEnvelope } from "@sacou/match-engine";
import type { Result } from "@sacou/volley-rules";

export type CourtLogErrorCode =
  "corrupted-log" | "sequence-conflict" | "session-not-found" | "storage-failed";

/** Carries only a code: a stored value or a database message could hold data. */
export interface CourtLogError {
  readonly code: CourtLogErrorCode;
}

export type CourtLogResult<T> = Result<T, CourtLogError>;

export interface StoredCourtLog {
  /** The write batch of this device in the stream (`eventos.md`). */
  readonly batch: number;
  readonly events: readonly EventEnvelope[];
}

/** The persisted log of the court sessions of this device: the one source of the match state. */
export interface CourtEventLog {
  /** A random UUID created on the first call and kept; never tied to hardware. */
  getDeviceId(): Promise<CourtLogResult<string>>;
  /** Idempotent: opening a session that exists changes nothing. */
  openSession(courtSessionId: string): Promise<CourtLogResult<void>>;
  /** The open session of the device, or `null`. */
  findActiveSession(): Promise<CourtLogResult<string | null>>;
  closeSession(courtSessionId: string): Promise<CourtLogResult<void>>;
  /** Events by position. A row the parser refuses fails the whole load. */
  load(courtSessionId: string): Promise<CourtLogResult<StoredCourtLog>>;
  /** All or nothing. The first sequence must follow the last one of the device in the stream. */
  append(
    courtSessionId: string,
    envelopes: readonly EventEnvelope[],
  ): Promise<CourtLogResult<void>>;
}
