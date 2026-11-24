import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { Group, Round } from "../../../services/api/sacou-api";
import { groupSettingsHref } from "../../groups/navigation";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { attendanceRound } from "../model/attendance.test.fixture";
import { roundSettingsOf } from "../model/round-detail";
import { AdminRoundScreen } from "./AdminRoundScreen";
import { PlayerRoundScreen } from "./PlayerRoundScreen";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: { spacing: { s: 8 } } }),
}));
vi.mock("../../court/hooks/use-round-court-entry", () => ({
  useRoundCourtEntry: () => ({ available: false, open: () => undefined }),
}));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: function Button() {} }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: () => null }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: function ErrorStrip() {} }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: function Text() {} }));
vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: () => null }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: () => null }));
vi.mock("../../../ui/MenuIcons", () => ({ ShareIcon: () => null }));
vi.mock("./RoundChips", () => ({ RoundChips: () => null }));
vi.mock("./RoundHeading", () => ({ RoundHeading: () => null, RoundLoading: () => null }));
vi.mock("./RoundStatsPanel", () => ({ RoundStatsPanel: () => null }));
vi.mock("./ConfirmedBlock", () => ({ ConfirmedBlock: () => null }));
vi.mock("./PresenceCard", () => ({ PresenceCard: () => null }));
vi.mock("./PresenceFooter", () => ({ PresenceFooter: () => null }));

const URL = "https://sacou.example/r/K7fQ2xK7fQ2xK7fQ2xK7fQ";
const STARTS = Date.parse("2026-11-05T22:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function modelAt(now: number, shareLink = vi.fn()): RoundScreenModel {
  return {
    state: { sheet: { kind: "none" }, copyNote: "none", shareNote: "none" },
    dispatch: () => undefined,
    now,
    responding: false,
    removing: false,
    shareLink,
  } as unknown as RoundScreenModel;
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

/** The body of screen 06 as props, and the buttons it draws once rendered. */
function adminBody(round: Round, now: number, shareLink = vi.fn()) {
  const group = { name: "Racha", role: "admin" } as Group;
  const settings = roundSettingsOf(round);
  const tree = AdminRoundScreen({
    groupId: "g",
    group,
    round,
    settings,
    members: [],
    model: modelAt(now, shareLink),
  });
  const [body] = findNamed(tree, "RoundBody");
  if (body === undefined) throw new Error("no body");
  const rendered = (body.type as (props: unknown) => ReactNode)(body.props);
  const labels = findNamed(rendered, "Button").map((button) => button.props.label);
  return { props: body.props, labels, rendered };
}

const open = attendanceRound({ shareUrl: URL });

describe("screen 06 hands the link on (R101 item 1)", () => {
  test("before the start, with the link: the button shows and calls the share with the round", () => {
    const shareLink = vi.fn();
    const { props, labels } = adminBody(open, STARTS - HOUR, shareLink);
    expect(props.canShare).toBe(true);
    expect(labels).toContain("Mandar no WhatsApp");
    (props.onShare as () => void)();
    expect(shareLink).toHaveBeenCalledWith("Racha", open);
  });

  test("the button has the accessible name of the plan", () => {
    const { rendered } = adminBody(open, STARTS - HOUR);
    const button = findNamed(rendered, "Button").find(
      (element) => element.props.label === "Mandar no WhatsApp",
    );
    expect(button?.props.accessibilityLabel).toBe("Mandar o link da rodada no WhatsApp");
  });

  test("without the link (shareUrl null), no button", () => {
    const { props, labels } = adminBody(attendanceRound({ shareUrl: null }), STARTS - HOUR);
    expect(props.canShare).toBe(false);
    expect(labels).not.toContain("Mandar no WhatsApp");
  });

  test("once the round started, ended or was canceled, no button", () => {
    expect(adminBody(open, STARTS).props.canShare).toBe(false);
    expect(
      adminBody(attendanceRound({ shareUrl: URL, status: "canceled" }), STARTS - HOUR).props
        .canShare,
    ).toBe(false);
    const closed = attendanceRound({ shareUrl: URL, endsAt: "2026-11-05T10:00:00Z" });
    expect(adminBody(closed, STARTS - HOUR).props.canShare).toBe(false);
  });

  test("screen 26 never reads the link, even when a round carries it by mistake", () => {
    const tree = PlayerRoundScreen({
      group: { name: "Racha", role: "player" } as Group,
      round: open,
      settings: roundSettingsOf(open),
      members: [],
      model: modelAt(STARTS - HOUR),
    });
    expect(findNamed(tree, "RoundBody")).toEqual([]);
    expect(JSON.stringify(tree)).not.toContain("canShare");
    expect(JSON.stringify(tree)).not.toContain("Mandar no WhatsApp");
  });
});

describe("screen 06 tells the window of the drop-ins (R101 item 2)", () => {
  const opensAt = new Date(STARTS - DAY).toISOString();
  const windowed = attendanceRound({ dropInOpensAt: opensAt });

  test("before the window: the phrase and 'Mudar', which opens Como jogamos (screen 18)", () => {
    const { props, labels } = adminBody(windowed, STARTS - DAY - 3 * HOUR);
    expect(props.dropInPhrase).toBe("hoje, às 19h");
    expect(labels).toContain("Mudar");
    (props.onChangeDropInWindow as () => void)();
    expect(router.push).toHaveBeenCalledWith(groupSettingsHref("g"));
  });

  test("with the window open, started, ended, canceled or off: nothing", () => {
    expect(adminBody(windowed, STARTS - DAY + HOUR).props.dropInPhrase).toBeNull();
    expect(adminBody(windowed, STARTS).props.dropInPhrase).toBeNull();
    const closed = { ...windowed, endsAt: "2026-11-04T10:00:00Z" };
    expect(adminBody(closed, STARTS - DAY - HOUR).props.dropInPhrase).toBeNull();
    const canceled = { ...windowed, status: "canceled" as const };
    expect(adminBody(canceled, STARTS - DAY - HOUR).props.dropInPhrase).toBeNull();
    expect(adminBody(attendanceRound(), STARTS - DAY - HOUR).props.dropInPhrase).toBeNull();
  });
});
