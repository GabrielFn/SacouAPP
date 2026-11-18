import type { SessionIdentity } from "../../../services/auth/auth-session";

/** The account signed in now, as the court upload sees it (ADR 0067, D8). */
export interface CourtAccountRef {
  /** The calls of the upload leave only with the token of this session. */
  readonly session: SessionIdentity;
  /** The owner key a court session keeps: a hash made in the adapter, never the UID. */
  readonly key: string;
}

export interface CourtAccount {
  current(): Promise<CourtAccountRef | null>;
  /** Called whenever the session changes (sign-in, sign-out, another account). */
  subscribe(listener: () => void): () => void;
}
