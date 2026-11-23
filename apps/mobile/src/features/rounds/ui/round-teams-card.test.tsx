import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Group, Round } from "../../../services/api/sacou-api";
import { createScaledTokens } from "../../../theme/scale";
import { G1_ORDER, RESERVES, TEAM_A, TEAM_B, g1Members } from "../../draw/model/draw.test.fixture";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { attendanceRound, goingOf } from "../model/attendance.test.fixture";
import { roundSettingsOf } from "../model/round-detail";
import { roundTeamsView } from "../model/round-teams";
import { AdminRoundScreen } from "./AdminRoundScreen";
import { PlayerRoundScreen } from "./PlayerRoundScreen";
import { RoundTeamsCard } from "./RoundTeamsCard";

const screen = vi.hoisted(() => ({ width: 360, fontScale: 1 }));

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({
    colors: {},
    tokens: createScaledTokens({ windowWidth: screen.width, fontScale: screen.fontScale }),
  }),
}));
vi.mock("../../court/hooks/use-round-court-entry", () => ({
  useRoundCourtEntry: () => ({ available: false, open: () => undefined }),
}));
vi.mock("../../../ui/BackBar", () => ({ BackBar: function BackBar() {} }));
vi.mock("../../../ui/Button", () => ({ Button: function Button() {} }));
vi.mock("../../../ui/ConfirmSheet", () => ({ ConfirmSheet: function ConfirmSheet() {} }));
vi.mock("../../../ui/ErrorStrip", () => ({ ErrorStrip: function ErrorStrip() {} }));
vi.mock("../../../ui/Screen", () => ({ Screen: function Screen() {} }));
vi.mock("../../../ui/Text", () => ({ Text: function Text() {} }));
vi.mock("../../../ui/Icons", () => ({ PlusIcon: function PlusIcon() {} }));
vi.mock("./RoundChips", () => ({ RoundChips: function RoundChips() {} }));
vi.mock("./RoundHeading", () => ({ RoundHeading: function RoundHeading() {} }));
vi.mock("./RoundStatsPanel", () => ({ RoundStatsPanel: function RoundStatsPanel() {} }));
vi.mock("./ConfirmedBlock", () => ({ ConfirmedBlock: function ConfirmedBlock() {} }));
vi.mock("./ConfirmedSheet", () => ({ ConfirmedSheet: function ConfirmedSheet() {} }));
vi.mock("./PresenceCard", () => ({ PresenceCard: function PresenceCard() {} }));
vi.mock("./PresenceFooter", () => ({ PresenceFooter: function PresenceFooter() {} }));
vi.mock("./SummaryLink", () => ({ SummaryLink: function SummaryLink() {} }));
vi.mock("./EndedRound", () => ({
  EndedBadge: function EndedBadge() {},
  EndedFooter: function EndedFooter() {},
}));

interface Found {
  readonly name: string;
  readonly props: Readonly<Record<string, unknown>>;
}

const LEAVES = new Set([
  "BackBar",
  "Button",
  "ConfirmSheet",
  "ErrorStrip",
  "Screen",
  "Text",
  "PlusIcon",
  "RoundChips",
  "RoundHeading",
  "RoundStatsPanel",
  "ConfirmedBlock",
  "ConfirmedSheet",
  "PresenceCard",
  "PresenceFooter",
  "SummaryLink",
  "EndedBadge",
  "EndedFooter",
]);

/** Renders our own components by calling them, and keeps every element on the way (the leaves stay as they are). */
function expand(node: ReactNode): readonly Found[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => expand(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Record<string, ReactNode>>;
  const type = element.type;
  const name =
    typeof type === "string" ? type : typeof type === "function" ? type.name : "Fragment";
  const self: Found = { name, props: element.props };
  if (typeof type !== "function" || LEAVES.has(name)) {
    return [self, ...expand(element.props.children)];
  }
  const render = type as (props: unknown) => ReactNode;
  return [self, ...expand(render(element.props))];
}

const names = (found: readonly Found[]) => found.map((item) => item.name);
const strings = (found: readonly Found[]) =>
  found.flatMap((item) => {
    const children = item.props.children;
    return typeof children === "string" ? [children] : [];
  });

/** 18h, the hour before the round of the fixture (Qui 5/11 19h in São Paulo). */
const NOW = Date.parse("2026-11-05T21:00:00Z");

function g1(patch: Partial<Round> = {}, going: readonly string[] = G1_ORDER): Round {
  return attendanceRound({
    capacity: null,
    goingCount: going.length,
    going: going.map((memberId, index) => goingOf(memberId, index + 1)),
    me: { memberId: "bia", status: "going", position: 6, regularPosition: null },
    teams: {
      confirmedAt: "2026-11-05T22:42:00Z",
      teams: [
        { number: 1, memberIds: [...TEAM_A] },
        { number: 2, memberIds: [...TEAM_B] },
      ],
      reserves: [...RESERVES],
    },
    ...patch,
  });
}

function model(now = NOW): RoundScreenModel {
  return {
    state: { sheet: { kind: "none" }, copyNote: "none" },
    dispatch: () => undefined,
    now,
    responding: false,
    removing: false,
    errorText: null,
  } as unknown as RoundScreenModel;
}

function player(round: Round, now = NOW) {
  const group = { groupId: "g", name: "Racha de terça", role: "player" } as Group;
  return expand(
    PlayerRoundScreen({
      group,
      round,
      settings: roundSettingsOf(round),
      members: g1Members(),
      model: model(now),
    }),
  );
}

function admin(round: Round, now = NOW) {
  const group = { groupId: "g", name: "Racha de terça", role: "admin" } as Group;
  return expand(
    AdminRoundScreen({
      groupId: "g",
      group,
      round,
      settings: roundSettingsOf(round),
      members: g1Members(),
      model: model(now),
    }),
  );
}

beforeEach(() => {
  screen.width = 360;
  screen.fontScale = 1;
});

describe("the Times card on screen 26 (R100)", () => {
  test("sits between 'Sua presença' and 'Confirmados', with where the reader is", () => {
    const found = player(g1());
    const order = names(found);
    const card = order.indexOf("RoundTeamsCard");
    expect(card).toBeGreaterThan(order.indexOf("PresenceCard"));
    expect(card).toBeLessThan(order.indexOf("ConfirmedBlock"));
    const texts = strings(found);
    expect(texts).toContain("Times");
    expect(texts).toContain("Saíram 19h42");
    expect(texts).toContain("Você está no Laranja");
    expect(texts).toContain("Reservas: 1 Davi, 2 Sofia");
  });

  test("is not there with no teams, nor in a cancelled round", () => {
    expect(names(player(g1({ teams: null })))).not.toContain("RoundTeamsCard");
    expect(names(player(g1({ status: "canceled" })))).not.toContain("RoundTeamsCard");
  });

  test("stays, read only, in an ended round", () => {
    const ended = g1({ closedAt: "2026-11-05T20:00:00Z", endsAt: "2026-11-05T20:00:00Z" });
    expect(names(player(ended))).toContain("RoundTeamsCard");
  });

  test("carries no level nor note", () => {
    expect(JSON.stringify(strings(player(g1())))).not.toMatch(/nota|\d,\d/i);
  });
});

describe("the Times card on screen 06 (R100)", () => {
  test("shows 'A lista mudou' to who draws when someone left (question 180)", () => {
    const left = g1(
      {},
      G1_ORDER.filter((id) => id !== "duda"),
    );
    const texts = strings(admin(left));
    expect(texts).toContain("A lista mudou depois dos times. Sorteie de novo.");
  });

  test("has no such line while the list is the one of the teams, nor in an ended round", () => {
    expect(strings(admin(g1()))).not.toContain("A lista mudou depois dos times. Sorteie de novo.");
    const left = g1(
      { closedAt: "2026-11-05T20:00:00Z", endsAt: "2026-11-05T20:00:00Z" },
      G1_ORDER.filter((id) => id !== "duda"),
    );
    const found = admin(left);
    expect(names(found)).toContain("RoundTeamsCard");
    expect(strings(found)).not.toContain("A lista mudou depois dos times. Sorteie de novo.");
  });
});

describe("the Times card fits (R100, case 20)", () => {
  test.each([
    [360, 1],
    [390, 1],
    [430, 1],
    [360, 1.3],
  ])("at %i dp and font scale %s the names wrap instead of being cut", (width, fontScale) => {
    screen.width = width;
    screen.fontScale = fontScale;
    const view = roundTeamsView(g1(), g1Members());
    if (view === null) throw new Error("no view");
    const found = expand(RoundTeamsCard({ view, listChangedText: null }));
    const nameLines = found.filter(
      (item) =>
        item.name === "Text" &&
        item.props.variant === "muted" &&
        Array.isArray(item.props.children),
    );
    expect(nameLines).toHaveLength(2);
    for (const line of nameLines) {
      const style = line.props.style as { flex?: number; flexShrink?: number; width?: unknown };
      expect(style.flexShrink).toBe(1);
      expect(style.width).toBeUndefined();
      expect(line.props.numberOfLines).toBeUndefined();
    }
    const rows = found.filter((item) => item.name === "View" && item.props.accessible === true);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      "Laranja: Ana, João, Pedro, Lia, Marcos e você",
      "Azul: Rafa, Duda, Caio, Nina, Léo e Gabi",
    ]);
  });
});
