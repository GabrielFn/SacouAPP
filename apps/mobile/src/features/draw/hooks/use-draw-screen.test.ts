import { beforeEach, describe, expect, test, vi } from "vitest";

import type { DrawFlowState } from "../model/draw-flow.reducer";
import { drawnG1, g1Members, g1Round, G1_ANSWER } from "../model/draw.test.fixture";
import type { DrawVariables } from "../queries/draw-mutation";
import { useDrawScreen } from "./use-draw-screen";

interface RunOptions {
  readonly onError?: () => void;
  readonly onSettled?: () => void;
}

const world = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIndex: 0,
  state: null as unknown,
  role: "admin" as string,
  online: true,
  mutate: vi.fn<(variables: DrawVariables, options?: RunOptions) => void>(),
  dispatch: vi.fn(),
  share: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useReducer: (_reducer: unknown, initial: unknown) => [world.state ?? initial, world.dispatch],
  useRef: (initial: unknown) => {
    const index = world.refIndex;
    world.refIndex += 1;
    world.refs[index] ??= { current: initial };
    return world.refs[index];
  },
  useEffect: (effect: () => void) => {
    effect();
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, error: null, mutate: world.mutate }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sacouApi: {}, shareSheet: { share: world.share } }),
}));
vi.mock("../../../services/api/use-online", () => ({ useOnline: () => world.online }));
vi.mock("../../groups/queries/use-group-queries", () => ({
  useGroup: () => ({ data: { name: "Racha de terça", role: world.role } }),
  useGroupMembers: () => ({ data: g1Members(), error: null }),
}));
vi.mock("../../rounds/queries/use-round-queries", () => ({
  useRound: () => ({ data: g1Round() }),
}));

/** One render of the hook, with the refs of the renders before it (as React keeps them). */
function render(state: DrawFlowState | null = null) {
  world.refIndex = 0;
  world.state = state;
  return useDrawScreen("g1", "r1");
}

beforeEach(() => {
  world.refs = [];
  world.role = "admin";
  world.online = true;
  world.mutate.mockReset();
  world.dispatch.mockReset();
  world.share.mockReset().mockResolvedValue(undefined);
});

describe("the first draw goes once per opening (D4)", () => {
  test("a re-render and a refetch never ask again", () => {
    render();
    render();
    render();
    expect(world.mutate).toHaveBeenCalledTimes(1);
    expect(world.mutate.mock.calls[0]?.[0].body).toEqual({});
  });

  test("the answer goes to the reducer as drawn", () => {
    render();
    world.mutate.mock.calls[0]?.[0].deliver(G1_ANSWER);
    expect(world.dispatch).toHaveBeenCalledWith({ type: "drawn", answer: G1_ANSWER });
  });

  test.each(["player", "scorekeeper"])("a %s opening the route never asks the API", (role) => {
    world.role = role;
    expect(render().screen).toEqual({ kind: "blocked", blocker: "forbidden" });
    expect(world.mutate).not.toHaveBeenCalled();
  });

  test("offline it waits; back online it asks once", () => {
    world.online = false;
    expect(render().screen).toEqual({ kind: "offline" });
    expect(world.mutate).not.toHaveBeenCalled();
    world.online = true;
    render();
    render();
    expect(world.mutate).toHaveBeenCalledTimes(1);
  });
});

describe("Sortear de novo", () => {
  test("a double tap in the same frame makes one call, with the locks and the reserves", () => {
    const model = render(drawnG1());
    model.redraw();
    model.redraw();
    expect(world.mutate).toHaveBeenCalledTimes(1);
    expect(world.mutate.mock.calls[0]?.[0].body).toEqual({
      locks: [],
      reserves: ["davi", "sofia"],
    });
    world.mutate.mock.calls[0]?.[1]?.onSettled?.();
    render(drawnG1()).redraw();
    expect(world.mutate).toHaveBeenCalledTimes(2);
  });

  test("a lock across teams asks at once, and goes back out if refused", () => {
    const locking = { ...drawnG1(), mode: "lock" as const, selection: "duda" };
    render(locking).tap("pedro");
    expect(world.mutate).toHaveBeenCalledTimes(1);
    expect(world.mutate.mock.calls[0]?.[0].body.locks).toEqual([
      { first: "duda", second: "pedro", kind: "together" },
    ]);
    world.mutate.mock.calls[0]?.[1]?.onError?.();
    expect(world.dispatch).toHaveBeenCalledWith({
      type: "lock-undone",
      lock: { first: "duda", second: "pedro" },
    });
  });

  test("a lock in the same team asks nothing", () => {
    const locking = { ...drawnG1(), mode: "lock" as const, selection: "duda" };
    render(locking).tap("rafa");
    expect(world.mutate).not.toHaveBeenCalled();
  });
});

describe("Confirmar e compartilhar (D11)", () => {
  test("shares the text of the teams once, with no level", () => {
    render(drawnG1()).share();
    expect(world.share).toHaveBeenCalledTimes(1);
    const text = world.share.mock.calls[0]?.[0] ?? "";
    expect(text).toContain("Laranja: Ana, João");
    expect(text).not.toMatch(/\d,\d/);
  });

  test("nothing is shared before the draw, nor while rendering", () => {
    render();
    render(drawnG1());
    expect(world.share).not.toHaveBeenCalled();
  });
});
