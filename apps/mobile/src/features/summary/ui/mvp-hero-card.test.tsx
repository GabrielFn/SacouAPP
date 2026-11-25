import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { MvpHeroCard } from "./MvpHeroCard";

const MVP_NAME_SIZE = 84;
const LINE_HEIGHT_RATIO = 0.9;
const WINDOW_WIDTHS = [320, 390, 600];
const LONG_NAME = "Maria Eduarda Albuquerque de Nascimento Sobrinho";

const window = vi.hoisted(() => ({ width: 390 }));

vi.mock("react-native", () => ({
  View: "View",
  StyleSheet: { absoluteFill: {} },
  useWindowDimensions: () => ({ width: window.width, height: 800 }),
}));
vi.mock("react-native-svg", () => ({ default: "Svg", Line: "Line", Path: "Path" }));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({
    colors: { panelSurface: "#000", onPanel: "#fff", panelAccent: "#fc0" },
    tokens: {
      radii: { pill: 22 },
      spacing: { l: 16, xl: 20, xs: 4, s6: 6 },
      sizes: { checkIcon: 18 },
      fontSizes: { displayMvp: MVP_NAME_SIZE, small: 14, legal: 12 },
    },
  }),
}));

type Node = ReactElement<{ children?: ReactNode; style?: Record<string, unknown> }>;

function all(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => all(child));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Node;
  return [element, ...all(element.props.children)];
}

describe("MvpHeroCard with a long name (E4.12, widths 320, 390 and 600)", () => {
  test.each(WINDOW_WIDTHS)("at %i the name stays on one line and shrinks to fit", (width) => {
    window.width = width;
    const nodes = all(
      MvpHeroCard({
        title: "MVP do dia",
        accessibility: "MVP do dia: Bia",
        name: LONG_NAME,
        line: "Laranja",
        notes: ["Calculado pelo placar"],
      }),
    );
    const name = nodes.find((node) => node.props.children === LONG_NAME);
    expect(name?.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(name?.props.style?.lineHeight).toBeCloseTo(MVP_NAME_SIZE * LINE_HEIGHT_RATIO);
  });

  test.each(WINDOW_WIDTHS)("at %i no box has a fixed width or height", (width) => {
    window.width = width;
    const nodes = all(
      MvpHeroCard({
        title: "MVP do dia",
        accessibility: "MVP do dia: Bia",
        name: LONG_NAME,
        line: "Laranja",
        notes: [],
      }),
    );
    const boxes = nodes.filter((node) => node.type === "View");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.props.style).not.toHaveProperty("width");
      expect(box.props.style).not.toHaveProperty("height");
    }
  });
});
