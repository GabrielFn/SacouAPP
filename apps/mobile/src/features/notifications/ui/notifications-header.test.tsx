import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { createScaledTokens } from "../../../theme/scale";
import { accessibilityFloors } from "../../../theme/tokens.data";
import { NotificationsHeader, notificationsHeaderWraps } from "./NotificationsHeader";

const WINDOW_WIDTHS = [320, 390, 600];
const FONT_SCALES = [1, 1.3];

const window = vi.hoisted(() => ({ width: 390, fontScale: 1 }));

vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  useWindowDimensions: () => ({ width: window.width, height: 800, fontScale: window.fontScale }),
}));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../ui/Icons", () => ({ BackIcon: "BackIcon" }));
vi.mock("../../../ui/IconButton", () => ({ IconButton: "IconButton" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({
    colors: { text: "#111", textMuted: "#666" },
    tokens: createScaledTokens({ windowWidth: window.width, fontScale: window.fontScale }),
  }),
}));

interface NodeProps {
  readonly children?: ReactNode;
  readonly style?: Record<string, unknown>;
  readonly numberOfLines?: number;
  readonly adjustsFontSizeToFit?: boolean;
  readonly minimumFontScale?: number;
  readonly accessibilityRole?: string;
}
type Node = ReactElement<NodeProps>;

function all(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => all(child));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Node;
  return [element, ...all(element.props.children)];
}

function render(width: number, fontScale: number): Node[] {
  window.width = width;
  window.fontScale = fontScale;
  return all(
    NotificationsHeader({ canMarkAll: true, onBack: () => undefined, onMarkAll: () => undefined }),
  );
}

const cases = WINDOW_WIDTHS.flatMap((width) => FONT_SCALES.map((scale) => [width, scale]));

describe("R98 item 8: the header of screen 28 in three widths and two font scales", () => {
  test.each(cases)("at %d wide and font %d the title stays on one line", (width, scale) => {
    const title = render(width, scale).find((node) => node.props.children === "Notificações");
    expect(title?.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(title?.props.minimumFontScale).toBeGreaterThan(0);
    expect(title?.props.minimumFontScale).toBeLessThan(1);
  });

  test.each(cases)("at %d wide and font %d Marcar como lidas never shrinks", (width, scale) => {
    const button = render(width, scale).find((node) => node.props.accessibilityRole === "button");
    expect(button?.props.style?.flexShrink).toBe(0);
    expect(button?.props.style?.minHeight).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
  });

  test("with the large font the button goes under the title, to the right", () => {
    expect(notificationsHeaderWraps(1)).toBe(false);
    expect(notificationsHeaderWraps(1.3)).toBe(true);
    const [outer] = render(390, 1.3);
    expect(outer?.props.style?.flexDirection).toBe("column");
    const button = render(390, 1.3).find((node) => node.props.accessibilityRole === "button");
    expect(button?.props.style?.alignSelf).toBe("flex-end");
    const [row] = render(390, 1);
    expect(row?.props.style?.flexDirection).toBe("row");
  });
});
