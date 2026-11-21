import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { cardFontScaleCap } from "../../../theme/card-tokens.data";
import { cardMeasuresFor, type ScaledCardMeasures } from "../../../theme/scale";
import { CARD_STAT_KEYS, type PlayerCardModel } from "../model/player-card";
import { cardLowerBudget } from "./player-card-budget";
import { cardLayout } from "./player-card.layout.data";
import { cardStyles, PlayerCardFace } from "./PlayerCardView";

vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock("react-native-svg", () => ({ default: "Svg", G: "G", Path: "Path", Rect: "Rect" }));
vi.mock("../../../ui/Icons", () => ({ PersonIcon: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../theme/theme-context", () => ({ useTheme: () => ({ colors: {} }) }));

interface Props {
  readonly style?: Record<string, unknown>;
  readonly children?: ReactNode;
}

/** Screen 15 on a 390 phone (70% inside the padding), the canvas card and the compact one (screen 14). */
const CARD_WIDTHS = [245, 270, 190] as const;
const LARGE_FONT_SCALES = [cardFontScaleCap, 2] as const;

const CARD: PlayerCardModel = {
  nickname: "Gabriel T",
  initials: "GA",
  positionLabel: "Qualquer uma",
  otherPositionsLabel: null,
  showGlyph: false,
  seasonLabel: "Temporada 2026",
  stats: CARD_STAT_KEYS.map((key) => ({ key, value: "1", label: key })),
};

/** Every element of the tree, function components expanded, so a style inside `StatsGrid` is seen too. */
function elements(node: ReactNode): readonly ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => elements(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Props>;
  if (typeof element.type === "function") {
    const component = element.type as (props: Props) => ReactNode;
    return elements(component(element.props));
  }
  return [element, ...elements(element.props.children)];
}

function measuresAt(width: number, fontScale: number): ScaledCardMeasures {
  return cardMeasuresFor(width, fontScale);
}

const MEASURES = measuresAt(CARD_WIDTHS[0], cardFontScaleCap);

function render(showStats: boolean) {
  return elements(PlayerCardFace({ card: CARD, showStats, measures: MEASURES }));
}

function lowerSection(all: readonly ReactElement<Props>[]) {
  return all.find((e) => e.props.style === cardStyles.lowerSection);
}

describe("player card layout", () => {
  test.each([true, false])("the footer is its own strip outside the grid (stats %s)", (show) => {
    const lower = lowerSection(render(show));
    const [statsArea, footer] = elements(lower?.props.children).filter(
      (e) => e.props.style === cardStyles.statsArea || e.props.style === cardStyles.footer,
    );
    expect(statsArea?.props.style).toBe(cardStyles.statsArea);
    expect(footer?.props.style).toBe(cardStyles.footer);
    expect(elements(statsArea?.props.children)).not.toContain(footer);
    expect(cardStyles.statsArea.flex).toBe(1);
  });

  test("nothing under the name band is positioned, and the strip starts where the band ends", () => {
    const inside = elements(lowerSection(render(true))?.props.children);
    expect(inside.length).toBeGreaterThan(CARD_STAT_KEYS.length);
    expect(inside.filter((e) => e.props.style?.position !== undefined)).toEqual([]);
    expect(
      parseFloat(cardLayout.nameBand.top) + parseFloat(cardLayout.nameBand.height),
    ).toBeCloseTo(parseFloat(cardLayout.lower.top));
  });

  test("the numbers have a line height equal to their size", () => {
    const values = render(true).filter((e) => e.props.style?.fontSize === MEASURES.statValueFont);
    expect(values).toHaveLength(CARD_STAT_KEYS.length);
    for (const value of values) expect(value.props.style?.lineHeight).toBe(MEASURES.statValueFont);
  });

  describe.each(CARD_WIDTHS)("a card %i wide", (width) => {
    test.each(LARGE_FONT_SCALES)("at font scale %s the grid and the footer fit", (fontScale) => {
      const budget = cardLowerBudget(width, measuresAt(width, fontScale));
      expect(budget.grid + budget.footer).toBeLessThanOrEqual(budget.available);
    });
  });

  test("the position stops before the avatar", () => {
    const position = render(true).find((e) => e.props.style?.left === cardLayout.position.left);
    expect(position?.props.style?.maxWidth).toBe(cardLayout.position.maxWidth);
    const avatarStart =
      100 - parseFloat(cardLayout.avatar.right) - parseFloat(cardLayout.avatar.width);
    expect(
      parseFloat(cardLayout.position.left) + parseFloat(cardLayout.position.maxWidth),
    ).toBeLessThan(avatarStart);
  });
});
