import type { CourtSyncState } from "../sync/court-sync.reducer";

/** What the upload loop shows: its state and the sessions it does not send for another account. */
export interface CourtSyncSnapshot {
  readonly loop: CourtSyncState;
  /** Sessions with events to send that belong to another account (or to none): never sent (D8). */
  readonly otherAccountSessions: readonly string[];
}

/** The points of the account signed in that the server has not confirmed yet ("Sair", question 84). */
export interface UnsentSummary {
  readonly events: number;
  readonly points: number;
}

/** What the court needs of the upload while it writes: the push after a write and the owner key. */
export interface CourtSyncHooks {
  /** Called after each write that committed: the events leave right away when nothing is in flight. */
  notifyAppended(): void;
  /** The owner key for a new round session, or `null` when nobody is signed in. */
  ownerKey(): Promise<string | null>;
}

/** The upload loop of the court (ADR 0067, D3): one for the app, started with the local database. */
export interface CourtSync extends CourtSyncHooks {
  start(): void;
  stop(): void;
  /** For `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
  getSnapshot(): CourtSyncSnapshot;
  /** Told when the loop wrote a halt or a take-over in a session, so its court reads the file again. */
  onSessionChanged(listener: (courtSessionId: string) => void): () => void;
  countUnsent(): Promise<UnsentSummary>;
}
