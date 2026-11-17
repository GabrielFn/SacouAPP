import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { Group } from "../../../services/api/sacou-api";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { attendanceRound, ME, memberOf } from "../model/attendance.test.fixture";
import { roundSettingsOf } from "../model/round-detail";
import { AdminRoundScreen } from "./AdminRoundScreen";
import { ConfirmedSheet } from "./ConfirmedSheet";
import { PlayerRoundScreen } from "./PlayerRoundScreen";
import { RoundScreen } from "./RoundScreen";

const roleState = vi.hoisted(() => ({ role: "player", round: {} }));

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ tokens: {} }) }));
vi.mock("../hooks/use-round-screen", () => ({
  useRoundScreen: () => ({
    group: { data: { name: "Racha", role: roleState.role } },
    round: { data: roleState.round },
    members: { data: [] },
  }),
}));
vi.mock("../../court/hooks/use-round-court", () => ({
  useRoundCourt: () => ({ status: "reading" }),
}));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: () => null }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: () => null }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: () => null }));
vi.mock("../../../ui/LoadingState", () => ({ LoadingState: () => null }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: () => null }));
vi.mock("./RoundChips", () => ({ RoundChips: () => null }));
vi.mock("./RoundHeading", () => ({ RoundHeading: () => null, RoundLoading: () => null }));
vi.mock("./RoundStatsPanel", () => ({ RoundStatsPanel: () => null }));
vi.mock("./ConfirmedBlock", () => ({ ConfirmedBlock: () => null }));
vi.mock("./PresenceCard", () => ({ PresenceCard: () => null }));
vi.mock("./PresenceFooter", () => ({ PresenceFooter: () => null }));

function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => find(child, type));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  const own = element.type === type ? [element as ReactElement<Record<string, unknown>>] : [];
  return [...own, ...find(element.props.children, type)];
}

function findNamed(node: ReactNode, name: string): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => findNamed(child, name));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  const own =
    typeof element.type === "function" && element.type.name === name
      ? [element as ReactElement<Record<string, unknown>>]
      : [];
  return [...own, ...findNamed(element.props.children, name)];
}

const model = {
  state: { sheet: { kind: "none" }, copyNote: "none" },
  dispatch: () => undefined,
  now: 0,
  responding: false,
  removing: false,
} as unknown as RoundScreenModel;

roleState.round = attendanceRound();

describe("Tirar only for who manages the rounds", () => {
  const round = attendanceRound();
  const members = [memberOf(ME, "Eu")];
  const settings = roundSettingsOf(round);

  test("the player screen gives the list no onRemove, even with the round full of people", () => {
    const group = { name: "Racha", role: "player" } as Group;
    const tree = PlayerRoundScreen({ group, round, settings, members, model });
    const sheets = find(tree, ConfirmedSheet);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.props.onRemove).toBeNull();
  });

  test("the admin screen gives the list an onRemove that asks first", () => {
    const group = { name: "Racha", role: "admin" } as Group;
    const dispatch = vi.fn();
    const tree = AdminRoundScreen({
      groupId: "g",
      group,
      round,
      settings,
      members,
      model: { ...model, dispatch },
    });
    const [removeSheets] = findNamed(tree, "RemoveSheets");
    expect(removeSheets).toBeDefined();
    const inner = (removeSheets?.type as (props: unknown) => ReactNode)(removeSheets?.props);
    const [sheet] = find(inner, ConfirmedSheet);
    const onRemove = sheet?.props.onRemove as (memberId: string) => void;
    onRemove("m-x");
    expect(dispatch).toHaveBeenCalledWith({ type: "remove-asked", memberId: "m-x" });
  });

  test.each([
    ["player", PlayerRoundScreen],
    ["scorekeeper", PlayerRoundScreen],
    ["admin", AdminRoundScreen],
    ["coAdmin", AdminRoundScreen],
  ])("the role %s picks the right screen", (role, screen) => {
    roleState.role = role;
    const tree = RoundScreen({ groupId: "g", roundId: "r" }) as ReactElement;
    expect(tree.type).toBe(screen);
  });
});
