import type { DependencyList, EffectCallback, ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createFakeBackGuard, type FakeBackGuard } from "../../../adapters/fake-back-guard";
import type { AppConfig } from "../../../services/api/sacou-api";
import { AppVersionGate } from "./AppVersionGate";
import { UpdateRequiredScreen } from "./UpdateRequiredScreen";

interface GateState {
  config: AppConfig | undefined;
  build: number | null;
  guard: FakeBackGuard;
  effects: { run: EffectCallback; deps: DependencyList | undefined }[];
}

const state = vi.hoisted<GateState>(() => ({
  config: undefined,
  build: 10,
  guard: undefined as unknown as FakeBackGuard,
  effects: [],
}));

// Runs the effect the way React would on mount: collected here, run by the test, cleaned up by the test.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (run: EffectCallback, deps?: DependencyList) => {
    state.effects.push({ run, deps });
  },
}));
vi.mock("../hooks/use-app-config", () => ({ useAppConfig: () => state.config }));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({
    appBuild: { platform: "android", build: state.build },
    externalLink: { open: () => Promise.resolve(true) },
    backGuard: state.guard,
  }),
}));
vi.mock("../../../ui/ErrorScreen", () => ({ ErrorScreen: "ErrorScreen" }));

function configWith(minimumAndroid: number): AppConfig {
  return {
    minimumBuild: { android: minimumAndroid, ios: 1 },
    updateUrl: { android: null, ios: null },
    features: { mvpVote: true },
  };
}

/** Renders the gate once and mounts its effect; returns the screen type and the unmount. */
function mount(): { type: unknown; unmount: () => void } {
  state.effects = [];
  const element = AppVersionGate({ children: "the app" }) as ReactElement;
  const cleanup = state.effects.map((effect) => effect.run());
  return {
    type: element.type,
    unmount: () => {
      for (const undo of cleanup) if (typeof undo === "function") undo();
    },
  };
}

beforeEach(() => {
  state.guard = createFakeBackGuard();
  state.config = undefined;
  state.build = 10;
});

describe("AppVersionGate and the Android back button (ADR 0084, D6)", () => {
  test("while 'Atualize o Sacou' shows, the back button is blocked; leaving the screen releases it", () => {
    state.config = configWith(11);

    const screen = mount();

    expect(screen.type).toBe(UpdateRequiredScreen);
    expect(state.guard.isBlocking()).toBe(true);
    screen.unmount();
    expect(state.guard.isBlocking()).toBe(false);
  });

  test.each([
    ["no answer yet", undefined, 10],
    ["a current build", configWith(10), 10],
    ["no readable build", configWith(99), null],
  ])("the app shows with %s: the back button is free", (_name, config, build) => {
    state.config = config;
    state.build = build;

    const screen = mount();

    expect(screen.type).not.toBe(UpdateRequiredScreen);
    expect(state.guard.isBlocking()).toBe(false);
  });

  test("the effect depends on the blocked state, so a fresh answer above the minimum releases the button", () => {
    state.config = configWith(11);
    const blocked = mount();
    state.config = configWith(10);
    state.effects = [];
    AppVersionGate({ children: "the app" });

    expect(state.effects[0]?.deps?.[0]).toBe(false);
    blocked.unmount();
    expect(state.guard.isBlocking()).toBe(false);
  });
});
