import type { CourtSyncState } from "../sync/court-sync.reducer";

/** What the upload loop shows: its state. Whose each session is comes from its file (D8). */
export interface CourtSyncSnapshot {
  readonly loop: CourtSyncState;
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
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => CourtSyncSnapshot;
  /** Told when the loop wrote a halt or a take-over in a session, so its court reads the file again. */
  onSessionChanged(listener: (courtSessionId: string) => void): () => void;
  /** Told when another account signs in or out, so an open court asks again whose it is. */
  onAccountChanged(listener: () => void): () => void;
  countUnsent(): Promise<UnsentSummary>;
}
