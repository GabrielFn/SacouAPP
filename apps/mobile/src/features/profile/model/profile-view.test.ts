import { describe, expect, test } from "vitest";

import { ApiFailure, type ApiError } from "../../../services/api/api-error";
import type { MyProfile, MyStats } from "../../../services/api/sacou-api";
import { profileView, type QuerySnapshot } from "./profile-view";

const PROFILE: MyProfile = {
  nickname: "João",
  primaryPosition: "outsideHitter",
  otherPositions: [],
  suggestedLevel: null,
};

function stats(matchesPlayed: number): MyStats {
  return {
    year: 2026,
    total: {
      matchesPlayed,
      wins: 0,
      losses: 0,
      plusMinus: 0,
      longestWinStreak: 0,
      mvpCount: 0,
      rounds: 0,
      roundsHeld: 0,
    },
    groups: [],
  };
}

function ok<T>(data: T): QuerySnapshot<T> {
  return { status: "success", fetchStatus: "idle", data, error: null };
}
const PENDING: QuerySnapshot<never> = {
  status: "pending",
  fetchStatus: "fetching",
  data: undefined,
  error: null,
};
const PAUSED: QuerySnapshot<never> = { ...PENDING, fetchStatus: "paused" };
function failed(error: ApiError): QuerySnapshot<never> {
  return { status: "error", fetchStatus: "idle", data: undefined, error: new ApiFailure(error) };
}

describe("the state of the Eu tab", () => {
  test("the profile still loading is loading, whatever the numbers say", () => {
    expect(profileView(PENDING, ok(stats(3)), true).kind).toBe("loading");
  });

  test("numbers loading with no cache, online, is loading", () => {
    expect(profileView(ok(PROFILE), PENDING, true).kind).toBe("loading");
  });

  test("no cache and no network is the offline page", () => {
    expect(profileView(ok(PROFILE), PAUSED, false).kind).toBe("offline-empty");
    expect(profileView(ok(PROFILE), failed({ kind: "offline" }), false).kind).toBe("offline-empty");
  });

  test.each<ApiError>([
    { kind: "unavailable", retryAfterMs: 0 },
    { kind: "rate-limited", retryAfterMs: 3000 },
  ])("a failure online is the error page: %o", (error) => {
    const view = profileView(ok(PROFILE), failed(error), true);
    expect(view).toEqual({ kind: "error", error });
  });

  test("numbers from the cache, offline, are ready and stale", () => {
    const view = profileView(ok(PROFILE), ok(stats(3)), false);
    expect(view.kind).toBe("ready");
    expect(view.kind === "ready" && view.stale).toBe(true);
  });

  test("zero matches is empty", () => {
    expect(profileView(ok(PROFILE), ok(stats(0)), true).kind).toBe("empty");
  });

  test("numbers online are ready, not stale", () => {
    const view = profileView(ok(PROFILE), ok(stats(3)), true);
    expect(view.kind === "ready" && view.stale).toBe(false);
  });

  test("a profile that was never saved (404) draws nothing: the gate opens screen 27", () => {
    expect(profileView(ok(null), ok(stats(3)), true).kind).toBe("loading");
  });

  test("a session that ended is an error page, never numbers", () => {
    const view = profileView(ok(PROFILE), failed({ kind: "session-expired" }), true);
    expect(view.kind).toBe("error");
  });
});
