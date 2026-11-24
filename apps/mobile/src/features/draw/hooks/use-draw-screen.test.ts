import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  drawFlowReducer,
  initialDrawFlowState,
  type DrawFlowState,
} from "../model/draw-flow.reducer";
import { withLeaf } from "../../groups/model/settings-patch";
import { drawnG1, drawSettings, g1Members, g1Round, G1_ANSWER } from "../model/draw.test.fixture";
import type { ConfirmTeamsBody } from "../../../services/api/sacou-api";
import type { DrawVariables } from "../queries/draw-mutation";
import { useDrawScreen } from "./use-draw-screen";

interface RunOptions {
  readonly onError?: () => void;
  readonly onSettled?: () => void;
}

const world = vi.hoisted(() => ({
  refs: new Array<{ current: unknown }>(),
  refIndex: 0,
  state: new Map<"state", unknown>(),
  role: new Map<"role", string>(),
  online: true,
  scoring: true,
  drawOn: true,
  mutate: vi.fn<(variables: DrawVariables, options?: RunOptions) => void>(),
  confirm: vi.fn<(body: ConfirmTeamsBody) => void>(),
  confirmFailed: false,
  dispatch: vi.fn(),
  share: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useReducer: (_reducer: unknown, initial: unknown) => [
    world.state.get("state") ?? initial,
    world.dispatch,
  ],
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
  // The publication of the teams is the only mutation with an `onSuccess` (R100).
  useMutation: (options: object) =>
    "onSuccess" in options
      ? { isPending: false, isError: world.confirmFailed, error: null, mutate: world.confirm }
      : { isPending: false, isError: false, error: null, mutate: world.mutate },
  useQueryClient: () => ({}),
}));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sacouApi: {}, shareSheet: { share: world.share } }),
}));
vi.mock("../../../services/api/use-online", () => ({ useOnline: () => world.online }));
vi.mock("../../groups/queries/use-group-queries", () => ({
  useGroup: () => ({ data: { name: "Racha de terça", role: world.role.get("role") } }),
  useGroupMembers: () => ({ data: g1Members(), error: null }),
}));
vi.mock("../../rounds/queries/use-round-queries", () => ({
  useRound: () => ({
    data: g1Round(undefined, {
      settings: {
        schemaVersion: 1,
        layer: null,
        resolved: withLeaf(drawSettings(world.drawOn), "scoring.enabled", world.scoring),
        sources: {},
      },
    }),
  }),
}));

/** The hook as a plain function: the mocks above stand in for React. */
const runDrawScreen = useDrawScreen;

/** One render of the hook, with the refs of the renders before it (as React keeps them). */
function render(state: DrawFlowState | null = null) {
  world.refIndex = 0;
  world.state.set("state", state);
  return runDrawScreen("g1", "r1");
}

beforeEach(() => {
  world.refs = [];
  world.role.set("role", "admin");
  world.online = true;
  world.scoring = true;
  world.drawOn = true;
  world.mutate.mockReset();
  world.confirm.mockReset();
  world.confirmFailed = false;
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
    world.role.set("role", role);
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

  test("offline it refuses before calling, with a local notice (D4)", () => {
    world.online = false;
    render(drawnG1()).redraw();
    expect(world.mutate).not.toHaveBeenCalled();
    expect(world.dispatch).toHaveBeenCalledWith({ type: "offline-refused" });
    expect(world.dispatch).not.toHaveBeenCalledWith({ type: "selection-cleared" });
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

  test("a double tap before the sheet closes shares once", async () => {
    let close: () => void = () => undefined;
    world.share.mockReturnValue(new Promise<void>((resolve) => (close = resolve)));
    const model = render(drawnG1());
    model.share();
    model.share();
    expect(world.share).toHaveBeenCalledTimes(1);
    close();
    await Promise.resolve();
    await Promise.resolve();
    render(drawnG1()).share();
    expect(world.share).toHaveBeenCalledTimes(2);
  });

  test("after the share sheet, shared or not, sheet 08 opens (D11)", async () => {
    render(drawnG1()).share();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(world.dispatch).toHaveBeenCalledWith({ type: "pre-game-opened" });
    world.dispatch.mockReset();
    world.share.mockRejectedValue(new Error("no share sheet"));
    render(drawnG1()).share();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(world.dispatch).toHaveBeenCalledWith({ type: "pre-game-opened" });
  });

  test("with the score off in the round there is no court: the 08 does not open (D6)", async () => {
    world.scoring = false;
    render(drawnG1()).share();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(world.share).toHaveBeenCalledTimes(1);
    expect(world.dispatch).not.toHaveBeenCalledWith({ type: "pre-game-opened" });
  });

  test("publishes the teams, IDs only, before the share sheet opens (R100, A)", () => {
    render(drawnG1()).share();
    expect(world.confirm).toHaveBeenCalledTimes(1);
    expect(world.confirm.mock.calls[0]?.[0]).toEqual({
      teams: [
        ["ana", "joao", "pedro", "lia", "marcos", "bia"],
        ["rafa", "duda", "caio", "nina", "leo", "gabi"],
      ],
      reserves: ["davi", "sofia"],
    });
    expect(JSON.stringify(world.confirm.mock.calls[0]?.[0])).not.toMatch(/level/i);
    const published = world.confirm.mock.invocationCallOrder[0] ?? Infinity;
    const shared = world.share.mock.invocationCallOrder[0] ?? -Infinity;
    expect(published).toBeLessThan(shared);
  });

  test("a double tap publishes once (R100, case 18)", () => {
    world.share.mockReturnValue(new Promise<void>(() => undefined));
    const model = render(drawnG1());
    model.share();
    model.share();
    expect(world.confirm).toHaveBeenCalledTimes(1);
  });

  test("a failed publication changes nothing in the flow and shows the notice (question 182)", async () => {
    world.confirmFailed = true;
    const model = render(drawnG1());
    model.share();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(model.publishFailed).toBe(true);
    expect(world.share).toHaveBeenCalledTimes(1);
    expect(world.dispatch).toHaveBeenCalledWith({ type: "pre-game-opened" });
  });

  test("redrawing publishes nothing (R100, A)", () => {
    render(drawnG1()).redraw();
    expect(world.confirm).not.toHaveBeenCalled();
    expect(render(drawnG1()).publishFailed).toBe(false);
  });

  test("nothing is shared before the draw, nor while rendering", () => {
    render();
    render(drawnG1());
    expect(world.share).not.toHaveBeenCalled();
  });
});

describe("Montar times, with the draw off (question 72)", () => {
  const BY_ARRIVAL = {
    teams: [
      ["ana", "joao", "pedro", "lia", "marcos", "bia"],
      ["rafa", "duda", "caio", "nina", "leo", "gabi"],
    ],
    reserves: ["davi", "sofia"],
    levels: new Map(),
  };

  beforeEach(() => {
    world.drawOn = false;
  });

  test("opens with the teams by arrival and never asks the API, online or not", () => {
    expect(render().screen).toEqual({ kind: "drawn", arrangement: BY_ARRIVAL, manual: true });
    world.online = false;
    expect(render().screen.kind).toBe("drawn");
    expect(world.mutate).not.toHaveBeenCalled();
  });

  test("the first tap keeps the teams by arrival, then selects", () => {
    render().tap("duda");
    expect(world.dispatch.mock.calls).toEqual([
      [{ type: "teams-built", arrangement: BY_ARRIVAL }],
      [{ type: "player-tapped", memberId: "duda" }],
    ]);
    expect(world.mutate).not.toHaveBeenCalled();
  });

  test("a later tap on the kept teams only taps", () => {
    const kept = drawFlowReducer(initialDrawFlowState, {
      type: "teams-built",
      arrangement: BY_ARRIVAL,
    });
    render(kept).tap("pedro");
    expect(world.dispatch.mock.calls).toEqual([[{ type: "player-tapped", memberId: "pedro" }]]);
  });

  test("Montar de novo goes back to the order of arrival, with no call", () => {
    render().redraw();
    expect(world.dispatch).toHaveBeenCalledWith({ type: "teams-reset" });
    expect(world.mutate).not.toHaveBeenCalled();
  });

  test("Confirmar shares the teams by arrival and opens the 08 over them", async () => {
    world.online = false;
    render().share();
    expect(world.confirm).toHaveBeenCalledWith({
      teams: BY_ARRIVAL.teams,
      reserves: BY_ARRIVAL.reserves,
    });
    expect(world.dispatch).toHaveBeenCalledWith({ type: "teams-built", arrangement: BY_ARRIVAL });
    expect(world.share.mock.calls[0]?.[0]).toContain("Laranja: Ana, João, Pedro, Lia, Marcos, Bia");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(world.dispatch).toHaveBeenCalledWith({ type: "pre-game-opened" });
  });
});
