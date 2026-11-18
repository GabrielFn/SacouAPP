import type {
  CourtSync,
  CourtSyncHooks,
  CourtSyncSnapshot,
} from "../features/court/ports/court-sync";
import { INITIAL_COURT_SYNC_STATE } from "../features/court/sync/court-sync.reducer";

/** The court without an upload: the sample sessions, the benchmark and the tests that do not send. */
export const inertCourtSyncHooks: CourtSyncHooks = {
  notifyAppended: () => undefined,
  ownerKey: () => Promise.resolve(null),
};

/** The hooks of the court with an account signed in, read on each call so a test can switch it. */
export function signedInCourtSyncHooks(account: { readonly key: string | null }): CourtSyncHooks {
  return {
    notifyAppended: () => undefined,
    ownerKey: () => Promise.resolve(account.key),
  };
}

const IDLE: CourtSyncSnapshot = { loop: INITIAL_COURT_SYNC_STATE };

export interface FakeCourtSync extends CourtSync {
  /** How many writes the court told about. */
  appendedCount(): number;
}

/** A `CourtSync` that sends nothing, for the screens and hooks that only read it. */
export function createFakeCourtSync(ownerKey: string | null = null): FakeCourtSync {
  const appended = { value: 0 };
  return {
    start: () => undefined,
    stop: () => undefined,
    notifyAppended() {
      appended.value += 1;
    },
    ownerKey: () => Promise.resolve(ownerKey),
    subscribe: () => () => undefined,
    getSnapshot: () => IDLE,
    onSessionChanged: () => () => undefined,
    onAccountChanged: () => () => undefined,
    countUnsent: () => Promise.resolve({ events: 0, points: 0 }),
    appendedCount: () => appended.value,
  };
}
