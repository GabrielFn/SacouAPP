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
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, data: undefined, error: null, mutate: vi.fn() }),
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
