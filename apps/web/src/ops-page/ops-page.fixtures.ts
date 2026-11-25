import type { AuthOutcome, AuthPort, SessionUser } from "../round-page/ports";

/** A body of `GET /v1/ops/metrics` as the API writes it, for the tests. */
export function metricsBody(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    environment: "test",
    generatedAt: "2026-11-24T18:04:00+00:00",
    cachedUntil: "2026-11-24T18:05:00+00:00",
    users: {
      registered: 31,
      deleted: 2,
      weeks: [
        { weekStart: "2026-10-05", registered: 0, deleted: 0 },
        { weekStart: "2026-10-12", registered: 4, deleted: 0 },
        { weekStart: "2026-10-19", registered: 0, deleted: 0 },
        { weekStart: "2026-10-26", registered: 0, deleted: 1 },
        { weekStart: "2026-11-02", registered: 5, deleted: 0 },
        { weekStart: "2026-11-09", registered: 0, deleted: 0 },
        { weekStart: "2026-11-16", registered: 12, deleted: 1 },
        { weekStart: "2026-11-23", registered: 3, deleted: 0 },
      ],
    },
    ...overrides,
  };
}

export function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Firebase in memory: `heard` is told what the page asked of it. */
export function fakeAuth(
  heard: (event: "signIn" | "signOut") => void,
  options: { user?: SessionUser | null } = {},
): AuthPort {
  const session: { current: SessionUser | null } = { current: options.user ?? null };
  const done: AuthOutcome = { kind: "done" };
  const signIn = () => {
    session.current = { displayName: "Gabriel" };
    heard("signIn");
    return Promise.resolve(done);
  };
  return {
    restore: () => Promise.resolve(session.current),
    signInWithGooglePopup: signIn,
    signInWithGoogleRedirect: signIn,
    signInWithEmail: signIn,
    signUpWithEmail: signIn,
    sendPasswordReset: () => Promise.resolve(done),
    currentUser: () => session.current,
    idToken: () => Promise.resolve(session.current === null ? null : "id-token"),
    signOut: () => {
      session.current = null;
      heard("signOut");
      return Promise.resolve();
    },
  };
}
