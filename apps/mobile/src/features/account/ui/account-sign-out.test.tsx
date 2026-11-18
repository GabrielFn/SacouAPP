import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { AccountView } from "../../../services/auth/auth-session";
import { strings } from "../../../strings/pt-BR";
import { AccountScreen } from "./AccountScreen";

const ender = vi.hoisted(() => ({ end: vi.fn(() => Promise.resolve()) }));
const unsent = vi.hoisted(() => ({ value: Promise.resolve({ events: 0, points: 0 }) }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("react-native", () => ({ View: "View" }));
vi.mock("../../../services/services-context", () => ({
  useServices: () => ({ sessionEnder: ender, legalLinks: {}, externalLink: {} }),
}));
vi.mock("../../court/hooks/court-sync-context", () => ({
  useCourtSync: () => ({ countUnsent: () => unsent.value }),
}));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: () => null }));
vi.mock("../../profile/hooks/use-profile", () => ({ useMyProfile: () => ({ data: null }) }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ tokens: {}, colors: {} }) }));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/MenuIcons", () => ({
  DocumentIcon: () => null,
  ShieldIcon: () => null,
  SignOutIcon: () => null,
  DownloadIcon: () => null,
}));
vi.mock("./DeleteAccountCard", () => ({ DeleteAccountCard: () => null }));
vi.mock("./ExportDataSheet", () => ({ ExportDataSheet: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("./AccountRow", () => ({ AccountCard: () => null, AccountRow: () => null }));

interface RowProps {
  readonly label?: string;
  readonly onPress?: () => void;
}

function rowsOf(node: ReactNode): readonly RowProps[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => rowsOf(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ readonly children?: ReactNode } & RowProps>;
  return [element.props, ...rowsOf(element.props.children)];
}

const ACCOUNT: AccountView = { email: null, provider: "google" } as unknown as AccountView;

describe("the account screen (30)", () => {
  test("Sair goes through the SessionEnder, so the cache, the links and the skip are forgotten", async () => {
    const signOut = rowsOf(AccountScreen({ account: ACCOUNT })).find(
      (row) => row.label === strings.account.signOut,
    );
    signOut?.onPress?.();
    await vi.waitFor(() => {
      expect(ender.end).toHaveBeenCalledExactlyOnceWith("signedOut");
    });
  });
});
