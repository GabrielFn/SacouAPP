import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import { createScaledTokens } from "../../../theme/scale";
import { groupsHref } from "../../groups/navigation";
import type { GroupRoundsModel } from "../hooks/use-group-rounds";
import { groupRoundsView } from "../model/group-rounds";
import { createRoundHref, roundHref, summaryHref } from "../navigation";
import { GroupRoundRow } from "./GroupRoundRow";
import { GroupRoundsContent, GroupRoundsScreen } from "./GroupRoundsScreen";

const screen = vi.hoisted(() => ({
  width: 360,
  push: vi.fn(),
  model: { kind: "loading" },
}));

vi.mock("expo-router", () => ({ useRouter: () => ({ push: screen.push }) }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({
    colors: {},
    tokens: createScaledTokens({ windowWidth: screen.width, fontScale: 1 }),
  }),
}));
vi.mock("../hooks/use-group-rounds", () => ({ useGroupRounds: () => screen.model }));
vi.mock("../../../ui/BackBar", () => ({ BackBar: function BackBar() {} }));
vi.mock("../../../ui/EmptyState", () => ({ EmptyState: function EmptyState() {} }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: function PlusIcon() {} }));
vi.mock("../../../ui/LoadingState", () => ({ LoadingState: function LoadingState() {} }));
vi.mock("../../../ui/OfflineBanner", () => ({ OfflineBanner: function OfflineBanner() {} }));
vi.mock("../../../ui/PillButton", () => ({ PillButton: function PillButton() {} }));
vi.mock("../../../ui/Screen", () => ({ Screen: function Screen() {} }));
vi.mock("../../../ui/Text", () => ({ Text: function Text() {} }));
vi.mock("../../groups/ui/DayStrip", () => ({ DayStrip: function DayStrip() {} }));
vi.mock("./RoundCardStatus", () => ({ RoundCardStatus: function RoundCardStatus() {} }));

interface Found {
  readonly name: string;
  readonly props: Readonly<Record<string, unknown>>;
}

const LEAVES = new Set([
  "BackBar",
  "EmptyState",
  "PlusIcon",
  "LoadingState",
  "OfflineBanner",
  "PillButton",
  "Screen",
  "Text",
  "DayStrip",
  "RoundCardStatus",
]);

/** Renders our own components by calling them, and keeps every element on the way (the leaves stay as they are). */
function expand(node: ReactNode): readonly Found[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => expand(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Record<string, ReactNode>>;
  const type = element.type;
  const name = typeof type === "string" ? type : (type as { name: string }).name;
  const self: Found = { name, props: element.props };
  if (typeof type === "string" || LEAVES.has(name)) {
    return [self, ...expand(element.props.children)];
  }
  const render = type as (props: unknown) => ReactNode;
  return [self, ...expand(render(element.props))];
}

const named = (found: readonly Found[], name: string) => found.filter((item) => item.name === name);
const texts = (found: readonly Found[]) =>
  named(found, "Text").flatMap((item) =>
    typeof item.props.children === "string" ? [item.props.children] : [],
  );

const START = Date.parse("2026-11-19T20:00:00Z");
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function round(id: string, startsAt: number, extra: Partial<RoundSummary> = {}): RoundSummary {
  return {
    roundId: id,
    seriesId: null,
    localDate: "2026-11-19",
    localTime: "17:00",
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + HOUR_MS).toISOString(),
    venue: "Ginásio Sesc",
    status: "scheduled",
    capacity: 12,
    goingCount: 3,
    waitlistCount: 0,
    me: { status: null, position: null },
    ...extra,
  };
}

function listOf(
  rounds: readonly RoundSummary[],
  canCreate: boolean,
  now = START - HOUR_MS,
): GroupRoundsModel {
  return {
    kind: "list",
    view: groupRoundsView("g1", rounds, now),
    groupName: "Racha de terça",
    canCreate,
    bannerText: null,
  };
}

function render(model: GroupRoundsModel): readonly Found[] {
  screen.model = model;
  return expand(GroupRoundsScreen({ groupId: "g1" }));
}

beforeEach(() => {
  screen.push.mockClear();
  screen.width = 360;
});

describe("Nova rodada is for who organizes", () => {
  test("shown for who can create, and it opens screen 20", () => {
    const [pill] = named(render(listOf([], true)), "PillButton");
    expect(pill?.props.label).toBe("Nova rodada");
    (pill?.props.onPress as () => void)();
    expect(screen.push).toHaveBeenCalledWith(createRoundHref("g1"));
  });

  test("hidden for a player, an unknown role and while loading", () => {
    expect(named(render(listOf([], false)), "PillButton")).toHaveLength(0);
    expect(named(render({ kind: "loading" }), "PillButton")).toHaveLength(0);
  });
});

describe("where a round leads", () => {
  test("an open or live round opens screen 06, an ended one the summary", () => {
    const now = START + HOUR_MS;
    const found = render(
      listOf([round("open", now + DAY_MS), round("ended", START - DAY_MS)], false, now),
    );
    const pressables = named(found, "Pressable");
    expect(pressables).toHaveLength(2);
    (pressables[0]?.props.onPress as () => void)();
    (pressables[1]?.props.onPress as () => void)();
    expect(screen.push).toHaveBeenNthCalledWith(1, roundHref("g1", "open"));
    expect(screen.push).toHaveBeenNthCalledWith(2, summaryHref("g1", "ended"));
  });
});

describe("a canceled round", () => {
  test("a canceled past round still opens screen 06, never the summary", () => {
    const now = START + HOUR_MS;
    const found = render(
      listOf([round("gone", START - DAY_MS, { status: "canceled" })], false, now),
    );
    const [row] = named(found, "Pressable");
    (row?.props.onPress as () => void)();
    expect(screen.push).toHaveBeenCalledWith(roundHref("g1", "gone"));
  });
});

describe("the states of the screen", () => {
  test("loading shows the indicator and no list", () => {
    const found = render({ kind: "loading" });
    expect(named(found, "LoadingState")).toHaveLength(1);
    expect(named(found, "Pressable")).toHaveLength(0);
  });

  test("an error offers Tentar de novo, that retries", () => {
    const retry = vi.fn();
    const [empty] = named(render({ kind: "error", retry }), "EmptyState");
    const [action] = empty?.props.actions as readonly { label: string; onPress: () => void }[];
    expect(action?.label).toBe("Tentar de novo");
    action?.onPress();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test("an empty list speaks to the organizer and to the player", () => {
    const organizer = named(render(listOf([], true)), "EmptyState")[0];
    expect(organizer?.props.body).toBe("Marque a próxima em Nova rodada.");
    const player = named(render(listOf([], false)), "EmptyState")[0];
    expect(player?.props.body).toBe("Quando a organização marcar uma rodada, ela aparece aqui.");
  });

  test("only upcoming: Recentes does not show", () => {
    const found = render(listOf([round("a", START + DAY_MS)], false));
    expect(texts(found)).toContain("Próximas");
    expect(texts(found)).not.toContain("Recentes");
  });

  test("only recent: Próximas says there is no round", () => {
    const found = render(listOf([round("a", START - DAY_MS)], false, START));
    expect(texts(found)).toContain("Nenhuma rodada marcada.");
    expect(texts(found)).toContain("Recentes");
  });

  test("the section titles are headers", () => {
    const found = render(
      listOf([round("a", START + DAY_MS), round("b", START - DAY_MS)], false, START),
    );
    const headers = named(found, "Text").filter(
      (item) => item.props.accessibilityRole === "header",
    );
    expect(headers.map((item) => item.props.children)).toEqual(["Próximas", "Recentes"]);
  });

  test("the back button goes to the groups list", () => {
    const [back] = named(render({ kind: "loading" }), "BackBar");
    expect(back?.props.fallbackHref).toBe(groupsHref);
  });

  test("GroupRoundsContent is a plain switch over the model", () => {
    expect(
      named(
        expand(GroupRoundsContent({ model: { kind: "loading" }, onOpen: vi.fn() })),
        "LoadingState",
      ),
    ).toHaveLength(1);
  });
});

describe("the row of a round (accessibility and layout)", () => {
  const item = groupRoundsView("g1", [round("a", START + DAY_MS)], START).upcoming[0];

  test("is a link with date, state and venue as its label", () => {
    if (item === undefined) throw new Error("no item");
    const [row] = named(expand(GroupRoundRow({ item, onOpen: vi.fn() })), "Pressable");
    expect(row?.props.accessibilityRole).toBe("link");
    expect(row?.props.accessibilityLabel).toBe("Qui, 19/11, Aberta, Ginásio Sesc");
  });

  test.each([280, 360, 480])(
    "keeps the 44 floor at %i dp wide (no width in the style)",
    (width) => {
      screen.width = width;
      if (item === undefined) throw new Error("no item");
      const [row] = named(expand(GroupRoundRow({ item, onOpen: vi.fn() })), "Pressable");
      const style = row?.props.style as { minHeight: number; width?: unknown };
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.width).toBeUndefined();
    },
  );
});
