import { beforeEach, describe, expect, test, vi } from "vitest";

import type { EndRoundAbout } from "./use-end-round";
import { useEndRound } from "./use-end-round";

/** A one-slot stand-in for `useReducer`, so the hook runs outside a renderer. */
const store = vi.hoisted(() => ({ state: undefined as unknown }));
const fakes = vi.hoisted(() => ({
  replace: vi.fn(),
  runEndRound: vi.fn(),
  findOrigin: vi.fn(),
  read: vi.fn(),
  api: { endRound: vi.fn() },
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useReducer: (reducer: (state: unknown, action: unknown) => unknown, initial: unknown) => {
    store.state ??= initial;
    return [
      store.state,
      (action: unknown) => {
        store.state = reducer(store.state, action);
      },
    ];
  },
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: fakes.replace }) }));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sacouApi: fakes.api, courtRounds: { read: fakes.read } }),
}));
vi.mock("../hooks/court-runtime-context", () => ({
  useCourtRuntime: () => ({ log: { findOrigin: fakes.findOrigin }, sync: {} }),
}));
vi.mock("./run-end-round", () => ({ runEndRound: fakes.runEndRound }));

const ABOUT: EndRoundAbout = { openMatchScore: null, finishedMatches: 3 };
const ORIGIN = { ok: true, value: { groupId: "g", roundId: "r" } };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const phase = () => (store.state as { phase: string }).phase;
const votingOf = () => (store.state as { votingEnabled: boolean }).votingEnabled;
const flow = () => useEndRound("c", vi.fn());

beforeEach(() => {
  store.state = undefined;
  vi.clearAllMocks();
  fakes.findOrigin.mockResolvedValue(ORIGIN);
  fakes.read.mockReturnValue({ settings: { mvp: { voting: true } } });
  fakes.runEndRound.mockResolvedValue({ ok: true, value: undefined });
});

describe("useEndRound asks before closing (R101, 3a)", () => {
  test("one tap opens the confirmation and calls nothing on the server", async () => {
    flow().request(ABOUT);
    await flush();
    expect(phase()).toBe("confirming");
    expect(votingOf()).toBe(true);
    expect(fakes.runEndRound).not.toHaveBeenCalled();
    expect(fakes.api.endRound).not.toHaveBeenCalled();
    expect(fakes.replace).not.toHaveBeenCalled();
  });

  test("only confirm runs the end and opens the summary", async () => {
    flow().request(ABOUT);
    await flush();
    flow().confirm();
    await flush();
    expect(fakes.runEndRound).toHaveBeenCalledTimes(1);
    expect(fakes.replace).toHaveBeenCalledTimes(1);
  });

  test("confirm without a request does nothing; cancel closes the sheet without calling", async () => {
    flow().confirm();
    await flush();
    expect(fakes.runEndRound).not.toHaveBeenCalled();
    flow().request(ABOUT);
    await flush();
    flow().cancel();
    expect(phase()).toBe("idle");
    expect(fakes.runEndRound).not.toHaveBeenCalled();
  });

  test("a second confirm while closing does not run the end twice", async () => {
    flow().request(ABOUT);
    await flush();
    flow().confirm();
    flow().confirm();
    await flush();
    expect(fakes.runEndRound).toHaveBeenCalledTimes(1);
  });

  test("the sheet opens with voting off when findOrigin fails, finds nothing or throws", async () => {
    const failures = [
      () => fakes.findOrigin.mockResolvedValue({ ok: false, error: "x" }),
      () => fakes.findOrigin.mockResolvedValue({ ok: true, value: null }),
      () => fakes.findOrigin.mockRejectedValue(new Error("disk")),
    ];
    for (const failing of failures) {
      store.state = undefined;
      failing();
      flow().request(ABOUT);
      await flush();
      expect(phase()).toBe("confirming");
      expect(votingOf()).toBe(false);
    }
    expect(fakes.runEndRound).not.toHaveBeenCalled();
  });

  test("the sheet opens with voting off when courtRounds.read throws", async () => {
    fakes.read.mockImplementation(() => {
      throw new Error("cache");
    });
    flow().request(ABOUT);
    await flush();
    expect(phase()).toBe("confirming");
    expect(votingOf()).toBe(false);
  });
});
