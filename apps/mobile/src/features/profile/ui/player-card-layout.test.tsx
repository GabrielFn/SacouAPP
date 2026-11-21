import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { createScaledTokens } from "../../../theme/scale";
import type { PlayerCardModel } from "../model/player-card";
import { cardLayout } from "./player-card.layout.data";
import { cardStyles, PlayerCardView } from "./PlayerCardView";

vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock("react-native-svg", () => ({ default: "Svg", G: "G", Path: "Path", Rect: "Rect" }));
vi.mock("../../../ui/Icons", () => ({ PersonIcon: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({
    colors: {},
    tokens: createScaledTokens({ windowWidth: 390, fontScale: 2 }),
  }),
}));

interface Props {
  readonly style?: Record<string, unknown>;
  readonly children?: ReactNode;
}

const CARD: PlayerCardModel = {
  nickname: "Gabriel T",
  initials: "GA",
  positionLabel: "Qualquer uma",
  showGlyph: false,
  seasonLabel: "Temporada 2026",
  stats: ["a", "b", "c", "d", "e", "f"].map((key) => ({ key, value: "1", label: key })),
} as unknown as PlayerCardModel;

function elements(node: ReactNode): readonly ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => elements(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Props>;
  return [element, ...elements(element.props.children)];
}

function render(showStats: boolean) {
  return elements(PlayerCardView({ card: CARD, size: "full", showStats }));
}

describe("player card layout", () => {
  test.each([true, false])("the footer is its own strip outside the grid (stats %s)", (show) => {
    const all = render(show);
    const lower = all.find((e) => e.props.style === cardStyles.lowerSection);
    const [statsArea, footer] = elements(lower?.props.children).filter(
      (e) => e.props.style === cardStyles.statsArea || e.props.style === cardStyles.footer,
    );
    expect(statsArea?.props.style).toBe(cardStyles.statsArea);
    expect(footer?.props.style).toBe(cardStyles.footer);
    expect(elements(statsArea?.props.children)).not.toContain(footer);
    expect(cardStyles.footer).not.toHaveProperty("position");
    expect(cardStyles.statsArea.flex).toBe(1);
  });

  test("nothing is positioned absolutely over the grid, and the strip starts below the name band", () => {
    const absolute = render(true).filter((e) => e.props.style?.position === "absolute");
    const insideLower = absolute.filter((e) => e.props.style === cardStyles.lowerSection);
    expect(insideLower).toHaveLength(1);
    expect(cardLayout.lower.top).toBe("62.5%");
    expect(
      parseFloat(cardLayout.nameBand.top) + parseFloat(cardLayout.nameBand.height),
    ).toBeCloseTo(parseFloat(cardLayout.lower.top));
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
