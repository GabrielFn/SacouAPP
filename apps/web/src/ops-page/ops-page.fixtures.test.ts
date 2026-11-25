import { describe, expect, it } from "vitest";

import { opsMetricsOf } from "./ops-metrics";
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
    groups: { total: 3, active: 2 },
    rounds: {
      created: 14,
      held: 11,
      closed: 9,
      canceled: 1,
      weeks: WEEKS.map((weekStart, index) => ({ weekStart, created: index % 2 })),
    },
    gate: {
      target: 0.6,
      requiredWeeks: 4,
      groupsGoal: 5,
      groupsMeeting: 1,
      total: gateCount(11, 60, 40, 30),
      weeks: WEEKS.map((weekStart, index) => ({
        weekStart,
        count: index === 0 ? gateCount(0, 0, 0, 0) : gateCount(1, 6, 4, 3),
      })),
      byGroup: [
        {
          name: "Vôlei de quinta",
          count: gateCount(7, 40, 30, 20),
          longestStreak: 5,
          meetsGate: true,
        },
        { name: "<b>Zé</b>", count: gateCount(0, 0, 0, 0), longestStreak: 0, meetsGate: false },
      ],
    },
    ...overrides,
  };
}

const WEEKS = [
  "2026-10-05",
  "2026-10-12",
  "2026-10-19",
  "2026-10-26",
  "2026-11-02",
  "2026-11-09",
  "2026-11-16",
  "2026-11-23",
];

/** The answers of some rounds, with the rates the API would compute (null with no confirmed). */
export function gateCount(rounds: number, confirmed: number, selfAnswered: number, byLink: number) {
  return {
    rounds,
    confirmed,
    selfAnswered,
    byLink,
    rate: confirmed === 0 ? null : selfAnswered / confirmed,
    linkRate: confirmed === 0 ? null : byLink / confirmed,
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

describe("ops page fixtures", () => {
  it("the body of the tests is one the page reads", () => {
    expect(opsMetricsOf(metricsBody())).not.toBeNull();
  });
});
