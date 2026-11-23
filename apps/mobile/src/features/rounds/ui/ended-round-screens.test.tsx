import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { Group, Round } from "../../../services/api/sacou-api";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { attendanceRound, ME, memberOf } from "../model/attendance.test.fixture";
import { roundSettingsOf } from "../model/round-detail";
import { AdminRoundScreen } from "./AdminRoundScreen";
import { summaryHref } from "../navigation";
import { EndedBadge, EndedFooter } from "./EndedRound";
import { PlayerRoundScreen } from "./PlayerRoundScreen";
import { Screen } from "../../../ui/Screen";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
const push = vi.hoisted(() => vi.fn());
vi.mock("expo-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ tokens: {} }) }));
vi.mock("../../court/hooks/use-round-court-entry", () => ({
  useRoundCourtEntry: () => ({ available: true, open: () => undefined }),
}));
vi.mock("../../../ui/BackBar", () => ({ BackBar: () => null }));
vi.mock("../../../ui/Button", () => ({ Button: () => null }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: () => null }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../../ui/StatusPill", () => ({ StatusPill: () => null }));
vi.mock("../../../ui/BottomSheet", () => ({ BottomSheet: () => null }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: () => null }));
vi.mock("./RoundChips", () => ({ RoundChips: () => null }));
vi.mock("./RoundHeading", () => ({ RoundHeading: () => null, RoundLoading: () => null }));
vi.mock("./RoundStatsPanel", () => ({ RoundStatsPanel: () => null }));
vi.mock("./ConfirmedBlock", () => ({ ConfirmedBlock: () => null }));
vi.mock("./ConfirmedSheet", () => ({ ConfirmedSheet: () => null }));
vi.mock("./PresenceCard", () => ({ PresenceCard: () => null }));
vi.mock("./PresenceFooter", () => ({ PresenceFooter: () => null }));

type Node = ReactElement<{ children?: ReactNode; footer?: ReactNode }>;

function elements(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => elements(child));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Node;
  return [element, ...elements(element.props.children), ...elements(element.props.footer)];
}

function has(node: ReactNode, type: unknown): boolean {
  return elements(node).some((element) => element.type === type);
}

const START = Date.parse("2026-11-23T20:00:00Z");
const MINUTE_MS = 60_000;
const NOW = START - 8 * 60 * MINUTE_MS;
const base = attendanceRound();

function roundEndingAt(endsAt: number): Round {
  return {
    ...base,
    startsAt: new Date(START).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  };
}

function modelAt(now: number): RoundScreenModel {
  return {
    state: { sheet: { kind: "none" }, copyNote: "none" },
    dispatch: () => undefined,
    now,
    responding: false,
    removing: false,
  } as unknown as RoundScreenModel;
}

const members = [memberOf(ME, "Eu")];

function admin(round: Round, now: number) {
  const group = { groupId: "g", name: "Racha", role: "admin" } as Group;
  return AdminRoundScreen({
    groupId: "g",
    group,
    round,
    settings: roundSettingsOf(round),
    members,
    model: modelAt(now),
  });
}

function player(round: Round, now: number) {
  const group = { groupId: "g", name: "Racha", role: "player" } as Group;
  return PlayerRoundScreen({
    group,
    round,
    settings: roundSettingsOf(round),
    members,
    model: modelAt(now),
  });
}

describe("a round closed before its start (R99 S2)", () => {
  const ended = roundEndingAt(NOW - MINUTE_MS);

  test("06 shows the seal and only 'Ver resumo' in the footer, with no summary link", () => {
    const tree = admin(ended, NOW);
    const [screen] = elements(tree).filter((element) => element.type === Screen);
    expect(has(tree, EndedBadge)).toBe(true);
    const footer = screen?.props.footer as ReactElement;
    expect(footer.type).toBe(EndedFooter);
  });

  test("26 shows the seal and 'Ver resumo' instead of the presence footer", () => {
    const tree = player(ended, NOW);
    const [screen] = elements(tree).filter((element) => element.type === Screen);
    expect(has(tree, EndedBadge)).toBe(true);
    expect((screen?.props.footer as ReactElement).type).toBe(EndedFooter);
  });

  test("a round ending exactly now is over; one ending 1 ms later is not", () => {
    const [boundary] = elements(admin(roundEndingAt(NOW), NOW)).filter((e) => e.type === Screen);
    expect((boundary?.props.footer as ReactElement).type).toBe(EndedFooter);
    const open = admin(roundEndingAt(NOW + 1), NOW);
    expect(has(open, EndedBadge)).toBe(false);
    const [screen] = elements(open).filter((element) => element.type === Screen);
    expect((screen?.props.footer as ReactElement | undefined)?.type).not.toBe(EndedFooter);
  });

  test("a canceled round never shows the ended seal", () => {
    const canceled: Round = { ...ended, status: "canceled" };
    expect(has(admin(canceled, NOW), EndedBadge)).toBe(false);
  });
});

describe("'Ver resumo' (R99)", () => {
  test("opens the summary of its own round", () => {
    const footer = EndedFooter({ groupId: "g-1", roundId: "r-9" }) as ReactElement<{
      onPress: () => void;
    }>;
    footer.props.onPress();
    expect(push).toHaveBeenCalledWith(summaryHref("g-1", "r-9"));
  });
});
