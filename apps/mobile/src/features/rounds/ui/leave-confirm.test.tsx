import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { Group } from "../../../services/api/sacou-api";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { attendanceRound } from "../model/attendance.test.fixture";
import { roundSettingsOf } from "../model/round-detail";
import { PlayerRoundScreen } from "./PlayerRoundScreen";
import { PresenceFooter } from "./PresenceFooter";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: { spacing: { s: 8 } } }),
}));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: function Button() {} }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: function ConfirmSheet() {} }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: function Screen() {} }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: () => null }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: () => null }));
vi.mock("./RoundHeading", () => ({ RoundHeading: () => null, RoundLoading: () => null }));
vi.mock("./ConfirmedBlock", () => ({ ConfirmedBlock: () => null }));

function findNamed(node: ReactNode, name: string): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => findNamed(child, name));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  const own = typeof element.type === "function" && element.type.name === name ? [element] : [];
  const { children, ...rest } = element.props as { children?: ReactNode };
  const inProps = Object.values(rest).flatMap((value) =>
    typeof value === "object" ? findNamed(value as ReactNode, name) : [],
  );
  return [...own, ...inProps, ...findNamed(children, name)];
}

describe("the leave button asks before leaving (R101, 3b)", () => {
  test("one tap on the footer button asks and never responds", () => {
    const onRespond = vi.fn();
    const onAskLeave = vi.fn();
    const footer = PresenceFooter({
      actions: {
        kind: "leave",
        label: "Não vou mais",
        needsConfirm: true,
        warning: null,
        leaveBody: "corpo",
      } as never,
      pending: false,
      onRespond,
      onAskLeave,
    });
    const [button] = findNamed(footer, "Button");
    (button?.props.onPress as () => void)();
    expect(onAskLeave).toHaveBeenCalledTimes(1);
    expect(onRespond).not.toHaveBeenCalled();
  });

  test("on screen 26 only the sheet confirm responds; cancel just closes", () => {
    const respond = vi.fn();
    const dispatch = vi.fn();
    const round = attendanceRound();
    const model = {
      state: { sheet: { kind: "leave" }, copyNote: "none", shareNote: "none" },
      dispatch,
      now: Date.parse("2026-11-05T20:00:00Z"),
      responding: false,
      respond,
    } as unknown as RoundScreenModel;
    const tree = PlayerRoundScreen({
      group: { name: "Racha", role: "player", groupId: "g" } as Group,
      round,
      settings: roundSettingsOf(round),
      members: [],
      model,
    });
    const [sheet] = findNamed(tree, "ConfirmSheet");
    expect(sheet?.props.visible).toBe(true);
    expect(respond).not.toHaveBeenCalled();
    (sheet?.props.onCancel as () => void)();
    expect(respond).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "sheet-closed" });
    (sheet?.props.onConfirm as () => void)();
    expect(respond).toHaveBeenCalledExactlyOnceWith("notGoing");
  });

  test("the footer wiring of screen 26 sends the tap to leave-asked, not to respond", () => {
    const respond = vi.fn();
    const dispatch = vi.fn();
    const round = attendanceRound();
    const model = {
      state: { sheet: { kind: "none" }, copyNote: "none", shareNote: "none" },
      dispatch,
      now: Date.parse("2026-11-05T20:00:00Z"),
      responding: false,
      respond,
    } as unknown as RoundScreenModel;
    const tree = PlayerRoundScreen({
      group: { name: "Racha", role: "player", groupId: "g" } as Group,
      round,
      settings: roundSettingsOf(round),
      members: [],
      model,
    });
    const [footer] = findNamed(tree, "PresenceFooter");
    expect(footer).toBeDefined();
    if (footer === undefined) return;
    (footer.props.onAskLeave as () => void)();
    expect(dispatch).toHaveBeenCalledWith({ type: "leave-asked" });
    expect(respond).not.toHaveBeenCalled();
  });
});
