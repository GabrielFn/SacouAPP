import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { appUpdateStrings } from "../../../strings/app-update.pt-BR";
import type { AppConfig } from "../../../services/api/sacou-api";
import type { AppBuild } from "../app-build";

const state = vi.hoisted(() => ({
  config: undefined as AppConfig | undefined,
  appBuild: { platform: "android", build: 10 } as AppBuild,
  opened: [] as string[],
  blocks: 0,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: () => undefined,
}));
vi.mock("../hooks/use-app-config", () => ({ useAppConfig: () => state.config }));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({
    appBuild: state.appBuild,
    externalLink: {
      open: (url: string) => {
        state.opened.push(url);
        return Promise.resolve(true);
      },
    },
    backGuard: {
      block: () => {
        state.blocks += 1;
        return () => undefined;
      },
    },
  }),
}));
vi.mock("../../../ui/ErrorScreen", () => ({ ErrorScreen: "ErrorScreen" }));

import { AppVersionGate } from "./AppVersionGate";
import { UpdateRequiredScreen } from "./UpdateRequiredScreen";

const STORE = "https://play.google.com/store/apps/details?id=com.sacou.app";

function configWith(minimumAndroid: number, url: string | null): AppConfig {
  return {
    minimumBuild: { android: minimumAndroid, ios: 1 },
    updateUrl: { android: url, ios: null },
    features: { mvpVote: true },
  };
}

function gate(): ReactElement {
  return AppVersionGate({ children: "the app" }) as ReactElement;
}

beforeEach(() => {
  state.config = undefined;
  state.appBuild = { platform: "android", build: 10 };
  state.opened = [];
});

describe("AppVersionGate (case 19)", () => {
  test("no answer yet (loading, offline without a cache): shows the app", () => {
    expect(gate().type).not.toBe(UpdateRequiredScreen);
  });

  test("a known answer at or below this build: shows the app", () => {
    state.config = configWith(10, STORE);

    expect(gate().type).not.toBe(UpdateRequiredScreen);
  });

  test("a known answer above this build, from the network or the persisted cache: blocks", () => {
    state.config = configWith(11, STORE);

    expect(gate().type).toBe(UpdateRequiredScreen);
    expect(gate().props).toMatchObject({ updateUrl: STORE });
  });

  test("a binary with no build is never blocked", () => {
    state.appBuild = { platform: "android", build: null };
    state.config = configWith(99, STORE);

    expect(gate().type).not.toBe(UpdateRequiredScreen);
  });

  test("a fresh answer above the minimum shows the app again", () => {
    state.config = configWith(11, STORE);
    const blocked = gate().type;
    state.config = configWith(10, STORE);

    expect(blocked).toBe(UpdateRequiredScreen);
    expect(gate().type).not.toBe(UpdateRequiredScreen);
  });

  test("an address that is not HTTPS is dropped: the screen has no button", () => {
    state.config = configWith(11, "http://store.test");

    expect(gate().props).toMatchObject({ updateUrl: null });
  });

  test("the button opens the store page", () => {
    state.config = configWith(11, STORE);
    const props = gate().props as { onUpdate: (url: string) => void };

    props.onUpdate(STORE);

    expect(state.opened).toEqual([STORE]);
  });
});

interface ScreenProps {
  readonly title: string;
  readonly body: string;
  readonly actions: readonly { label: string; onPress: () => void }[];
}

describe("UpdateRequiredScreen (case 21)", () => {
  test("with the address: the text and one button that opens it", () => {
    const opened: string[] = [];
    const screen = UpdateRequiredScreen({
      updateUrl: STORE,
      onUpdate: (url) => opened.push(url),
    }) as ReactElement<ScreenProps>;

    const { title, body, actions } = screen.props;
    expect([title, body]).toEqual([appUpdateStrings.title, appUpdateStrings.bodyWithLink]);
    expect(actions.map((action) => action.label)).toEqual([appUpdateStrings.update]);
    actions[0]?.onPress();
    expect(opened).toEqual([STORE]);
  });

  test("without the address: no button, and the text says whom to ask", () => {
    const screen = UpdateRequiredScreen({
      updateUrl: null,
      onUpdate: () => undefined,
    }) as ReactElement<ScreenProps>;

    expect(screen.props.actions).toEqual([]);
    expect(screen.props.body).toBe(appUpdateStrings.bodyWithoutLink);
  });
});
