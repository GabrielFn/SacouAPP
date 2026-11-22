import { describe, expect, test, vi } from "vitest";

import { createFakeCoinFlip } from "../../../adapters/fake-coin-flip";
import { drawSettings } from "../model/draw.test.fixture";
import { initialDrawFlowState } from "../model/draw-flow.reducer";
import { g1UuidArrangement } from "../model/pre-game.test.fixture";
import { usePreGame } from "./use-pre-game";

const coin = vi.hoisted(() => ({ current: null as { flip(): "a" | "b" } | null }));

vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ coinFlip: coin.current }),
}));
vi.mock("../../court/hooks/court-runtime-context", () => ({ useCourtRuntime: () => ({}) }));
vi.mock("../../court/hooks/use-round-court", () => ({
  useRoundCourt: () => ({ status: "reading" }),
}));
const otherRound = vi.hoisted(() => ({ revisions: [] as number[] }));
const mutation = vi.hoisted(() => ({ isPending: false, submittedAt: 0 }));
vi.mock("../../court/hooks/use-other-round-court", () => ({
  useOtherRoundCourt: (_roundId: string, revision: number) => {
    otherRound.revisions.push(revision);
    return { status: "reading" };
  },
}));
vi.mock("../../court/hooks/use-court-summary-lookup", () => ({
  useCourtSummaryLookup: () => ({ lookup: undefined, fetching: false, refresh: vi.fn() }),
}));
vi.mock("../../../services/api/use-online", () => ({ useOnline: () => false }));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: mutation.isPending,
    submittedAt: mutation.submittedAt,
    data: undefined,
    error: null,
    mutate: vi.fn(),
  }),
}));

const FLIPS = 40;

describe("usePreGame: 'Sortear' asks the injected coin (D10)", () => {
  test("flip dispatches the side of the service, in order, never a random one", () => {
    coin.current = createFakeCoinFlip(["b"]);
    const dispatch = vi.fn();
    const model = usePreGame({
      groupId: "g1",
      roundId: "r1",
      state: initialDrawFlowState,
      dispatch,
      arrangement: g1UuidArrangement(),
      settings: drawSettings(),
      members: [],
    });
    for (let times = 0; times < FLIPS; times += 1) model.flip();
    expect(dispatch.mock.calls.map(([action]) => (action as { side: string }).side)).toEqual(
      new Array<string>(FLIPS).fill("b"),
    );
  });
});

describe("usePreGame: the other round is read again once a start settles (R97, D5)", () => {
  const callOnce = (): void => {
    usePreGame({
      groupId: "g1",
      roundId: "r1",
      state: initialDrawFlowState,
      dispatch: vi.fn(),
      arrangement: g1UuidArrangement(),
      settings: drawSettings(),
      members: [],
    });
  };
  const lastRevision = (): number | undefined => otherRound.revisions.at(-1);

  test("revision is 0 while a start runs and the time of the last submit once it settles", () => {
    const settledAt = 1_700_000_000_000;
    mutation.isPending = true;
    mutation.submittedAt = settledAt;
    callOnce();
    expect(lastRevision()).toBe(0);

    mutation.isPending = false;
    callOnce();
    expect(lastRevision()).toBe(settledAt);

    // A new start that settles later changes the revision, which makes the 08 read the log again.
    mutation.submittedAt = settledAt + 1;
    callOnce();
    expect(lastRevision()).toBe(settledAt + 1);
  });
});
