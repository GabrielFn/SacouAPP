import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import type { MyGroup, RoundSummary } from "../../../services/api/sacou-api";
import { roundCardsOf, type RoundCardModel } from "../model/round-cards";
import { HomeRoundCards } from "./HomeRoundCards";

const cards = vi.hoisted(() => ({ now: 0, lists: [] as unknown[] }));

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ tokens: { spacing: {} } }) }));
vi.mock("../../../ui/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../hooks/use-round-cards", () => ({
  useRoundCards: (groups: readonly MyGroup[]) =>
    roundCardsOf(groups, cards.lists as readonly (readonly RoundSummary[])[], cards.now),
}));

const START = Date.parse("2026-11-19T20:00:00Z");
const HOUR_MS = 3_600_000;
const GROUP: MyGroup = { groupId: "g1", name: "Racha", role: "admin", memberType: "regular" };

function round(id: string, startsAt: number): RoundSummary {
  return {
    roundId: id,
    seriesId: null,
    localDate: "2026-11-19",
    localTime: "17:00",
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + HOUR_MS).toISOString(),
    venue: "Ginásio",
    status: "scheduled",
    capacity: null,
    goingCount: 0,
    waitlistCount: 0,
    me: { status: null, position: null },
  };
}

interface CardProps {
  readonly round: RoundCardModel;
  readonly onOpen: (groupId: string, roundId: string) => void;
}

function cardsIn(node: ReactNode): readonly CardProps[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => cardsIn(child));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const props = (node as ReactElement<Partial<CardProps> & { children?: ReactNode }>).props;
  if (props.round !== undefined && props.onOpen !== undefined) {
    return [{ round: props.round, onOpen: props.onOpen }];
  }
  return cardsIn(props.children);
}

describe("HomeRoundCards: where each card leads (R97, D3)", () => {
  test("the round being played opens screen 06, the one that ended opens the summary", () => {
    cards.now = START + HOUR_MS + 1;
    cards.lists = [[round("ended", START), round("live", START + HOUR_MS)]];
    const onOpenRound = vi.fn();
    const onOpenSummary = vi.fn();

    const tree = HomeRoundCards({ groups: [GROUP], emptyActions: [], onOpenRound, onOpenSummary });
    const found = cardsIn(tree);
    for (const card of found) card.onOpen(card.round.groupId, card.round.roundId);

    expect(found.map((card) => card.round.kind).sort()).toEqual(["live", "recent"]);
    expect(onOpenRound).toHaveBeenCalledWith("g1", "live");
    expect(onOpenSummary).toHaveBeenCalledWith("g1", "ended");
    expect(onOpenRound).toHaveBeenCalledTimes(1);
    expect(onOpenSummary).toHaveBeenCalledTimes(1);
  });
});

function keysIn(node: ReactNode): readonly string[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => keysIn(child));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ round?: RoundCardModel; children?: ReactNode }>;
  const own = element.props.round !== undefined && element.key !== null ? [element.key] : [];
  return [...own, ...keysIn(element.props.children)];
}

describe("HomeRoundCards: every round of the week (R97 part 2, D6)", () => {
  test("two rounds of the same group are two cards with different keys, the soonest first", () => {
    cards.now = START - HOUR_MS;
    cards.lists = [[round("b", START + HOUR_MS), round("a", START)]];
    const tree = HomeRoundCards({
      groups: [GROUP],
      emptyActions: [],
      onOpenRound: vi.fn(),
      onOpenSummary: vi.fn(),
    });
    expect(keysIn(tree)).toEqual(["next-a", "next-b"]);
  });

  test("cards of different groups come in order of start, not of group", () => {
    const other: MyGroup = { groupId: "g2", name: "Outro", role: "player", memberType: "regular" };
    cards.now = START - HOUR_MS;
    cards.lists = [[round("a", START + 2 * HOUR_MS)], [round("b", START)]];
    const found = cardsIn(
      HomeRoundCards({
        groups: [GROUP, other],
        emptyActions: [],
        onOpenRound: vi.fn(),
        onOpenSummary: vi.fn(),
      }),
    );
    expect(found.map((card) => card.round.roundId)).toEqual(["b", "a"]);
  });
});
