import type { IdTokenProvider } from "../services/api/id-token-provider";
import type { SessionIdentity } from "../services/auth/auth-session";

export const FAKE_ID_TOKEN = "fake-id-token-Zx9";

export interface FakeIdTokenProvider extends IdTokenProvider {
  /** How many tokens were asked for, and how many with `forceRefresh`. */
  requests(): { readonly total: number; readonly forced: number };
  sessionExpiredCount(): number;
  accountDeletedCount(): number;
  /** A renewal waits until `release` is called, to test calls refused at the same time. */
  holdRenewals(): { release(): void };
}

/**
 * Until E4.3 (Firebase) this is the only provider: a fixed token, only in a development build. In
 * release the app is given `null`, so it never calls the API.
 */
export function createFakeIdTokenProvider(
  token: string | null = FAKE_ID_TOKEN,
): FakeIdTokenProvider {
  const counts = { value: { total: 0, forced: 0, expired: 0, deleted: 0 } };
  const gate: { current: Promise<void> | null } = { current: null };
  const session: SessionIdentity = Object.freeze({ opaque: Symbol("fake-session") });
  return {
    currentSession: () => (token === null ? null : session),
    async getIdToken({ forceRefresh }) {
      const { total, forced } = counts.value;
      counts.value = {
        ...counts.value,
        total: total + 1,
        forced: forceRefresh ? forced + 1 : forced,
      };
      if (forceRefresh) await gate.current;
      return token;
    },
    onSessionExpired() {
      counts.value = { ...counts.value, expired: counts.value.expired + 1 };
    },
    onAccountDeleted() {
      counts.value = { ...counts.value, deleted: counts.value.deleted + 1 };
    },
    requests: () => ({ total: counts.value.total, forced: counts.value.forced }),
    sessionExpiredCount: () => counts.value.expired,
    accountDeletedCount: () => counts.value.deleted,
    holdRenewals() {
      const release: { current: () => void } = { current: () => undefined };
      gate.current = new Promise((resolve) => {
        release.current = resolve;
      });
      return {
        release: () => {
          release.current();
        },
      };
    },
  };
}
