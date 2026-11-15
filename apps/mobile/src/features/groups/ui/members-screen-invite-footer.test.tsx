import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MembersScreen } from "./MembersScreen";

const state = vi.hoisted(() => ({
  inviteBaseUrl: null as string | null,
  canInvite: true,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => [initial, () => undefined],
}));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ inviteBaseUrl: state.inviteBaseUrl }),
}));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: { spacing: { s10: 10 } } }),
}));
vi.mock("../hooks/use-members-screen", () => ({
  useMembersScreen: () => ({
    group: { data: { name: "Racha", role: "admin", activeMembers: 1 } },
    members: { data: [] },
    canInvite: state.canInvite,
    errorText: null,
    sheet: null,
    state: { sheetMemberId: null },
    dispatch: () => undefined,
  }),
}));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: () => null }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: () => null }));
vi.mock("../../../ui/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/LoadingState", () => ({ LoadingState: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/TabSwitch", () => ({ TabSwitch: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../../ui/Icons", () => ({ LinkIcon: () => null, QrIcon: () => null }));
vi.mock("./MemberOptionsSheet", () => ({ MemberOptionsSheet: () => null }));
vi.mock("./MembersLists", () => ({ InvitesList: () => null, MembersList: () => null }));

const footerOf = (): unknown =>
  (MembersScreen({ groupId: "g" }) as ReactElement<{ footer: unknown }>).props.footer;

describe("the invite footer of screen 19", () => {
  beforeEach(() => {
    state.inviteBaseUrl = "https://sacou.example/convite";
    state.canInvite = true;
  });

  test("shows Convidar for who manages invites when the app has a link base", () => {
    expect(footerOf()).toBeDefined();
  });

  test("hides Convidar when the build has no invite base url", () => {
    state.inviteBaseUrl = null;
    expect(footerOf()).toBeUndefined();
  });

  test("hides Convidar from who cannot manage invites", () => {
    state.canInvite = false;
    expect(footerOf()).toBeUndefined();
  });
});
