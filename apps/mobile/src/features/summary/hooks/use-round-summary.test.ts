import { describe, expect, test, vi } from "vitest";

import { apiOk } from "../../../services/api/api-result";
import type { RoundSummaryReport, SacouApi } from "../../../services/api/sacou-api";
import { E2_9_ROUND } from "../model/e2-9-round.test.fixture";
import { SCENARIOS } from "../mvp-vote/model/mvp-ballot.test.fixture";

interface RecordedOptions {
  readonly queryKey: readonly unknown[];
  readonly enabled?: boolean;
  readonly queryFn?: () => unknown;
}

const state = vi.hoisted(() => ({
  summary: undefined as unknown,
  api: undefined as unknown,
}));

vi.mock("react", () => ({ useEffect: () => undefined }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
  useQuery: (options: RecordedOptions) => {
    if (options.queryKey.includes("mvp-voting")) {
      // What the library does: the query function runs only when the query is enabled.
      if (options.enabled !== false) void options.queryFn?.();
      return { status: "pending", data: undefined, error: null, refetch: () => undefined };
    }
    return { status: "success", data: state.summary, error: null, refetch: () => undefined };
  },
}));
vi.mock("../../../services/api/use-online", () => ({ useOnline: () => true }));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({
    sacouApi: state.api,
    shareSheet: { share: () => Promise.resolve() },
    scheduler: { after: () => () => undefined },
  }),
}));
vi.mock("../../groups/queries/use-group-queries", () => ({
  useGroup: () => ({ data: { name: "Quadra" } }),
  useGroupMembers: () => ({ data: [] }),
}));
vi.mock("./use-unsent-points", () => ({ useUnsentPoints: () => 0 }));
vi.mock("./use-minute-tick", () => ({ useMinuteTick: () => 0 }));

import { useRoundSummary } from "./use-round-summary";

function ballotCalls(mvpVoting: RoundSummaryReport["mvpVoting"]): number {
  const getMvpVoting = vi.fn(() => Promise.resolve(apiOk(SCENARIOS.open)));
  state.api = { getMvpVoting } as unknown as SacouApi;
  state.summary = { ...E2_9_ROUND, mvpVoting };
  useRoundSummary("group-1", "round-1");
  return getMvpVoting.mock.calls.length;
}

describe("the ballot is read only while the voting is open (review finding)", () => {
  test("voting off, not open and closed never call getMvpVoting", () => {
    expect(ballotCalls(null)).toBe(0);
    expect(ballotCalls({ state: "notOpen", opensAt: "2026-11-20T00:00:00Z" })).toBe(0);
    expect(
      ballotCalls({
        state: "closed",
        opensAt: "2026-11-20T00:00:00Z",
        closesAt: "2026-11-21T00:00:00Z",
      }),
    ).toBe(0);
  });

  test("an open voting calls it once", () => {
    expect(
      ballotCalls({
        state: "open",
        opensAt: "2026-11-20T00:00:00Z",
        closesAt: "2026-11-21T00:00:00Z",
      }),
    ).toBe(1);
  });
});
