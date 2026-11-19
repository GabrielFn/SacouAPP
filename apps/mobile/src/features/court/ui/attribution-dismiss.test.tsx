import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { AttributionSheet, type AttributionSheetProps } from "./AttributionSheet";
import { SheetSurface } from "./SheetPanel";

vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  StyleSheet: { absoluteFill: {} },
  useWindowDimensions: () => ({ width: 780, height: 360 }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("../../../theme/theme-context", async () => {
  const { createScaledTokens } = await import("../../../theme/scale");
  const tokens = createScaledTokens({ windowWidth: 360, fontScale: 1 });
  return {
    useTheme: () => ({ tokens, colors: {} }),
    ThemeProvider: "ThemeProvider",
  };
});
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../ui/Icons", () => ({ AlertCircleIcon: "Icon", CheckIcon: "Icon" }));

interface Props {
  readonly children?: unknown;
  readonly onPress?: () => void;
  readonly onDismiss?: () => void;
  readonly pointerEvents?: string;
  readonly accessibilityViewIsModal?: boolean;
}

function find(
  node: unknown,
  match: (element: ReactElement<Props>) => boolean,
): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, match));
  if (typeof node !== "object" || node === null || !("props" in node)) return [];
  const element = node as ReactElement<Props>;
  return [...(match(element) ? [element] : []), ...find(element.props.children, match)];
}

describe("tap outside the point author sheet", () => {
  test("the sheet asks the surface to dismiss with the same path as Pular", () => {
    const onSkip = vi.fn();
    const props = { model: {}, onSkip } as unknown as AttributionSheetProps;
    const root = AttributionSheet(props) as ReactElement<Props>;
    expect(root.type).toBe(SheetSurface);
    expect(root.props.onDismiss).toBe(onSkip);
  });

  test("on screens 24 and 25 the tap only closes, it does not go to the next point", () => {
    const onSkip = vi.fn();
    const onClose = vi.fn();
    const props = { model: {}, onSkip, onClose } as unknown as AttributionSheetProps;
    const root = AttributionSheet(props) as ReactElement<Props>;
    expect(root.props.onDismiss).toBe(onClose);
    expect(onSkip).not.toHaveBeenCalled();
  });

  test("the sheet is modal for the screen reader", () => {
    const tree = SheetSurface({ placement: "bottom", children: null });
    expect(find(tree, (el) => el.props.accessibilityViewIsModal === true)).toHaveLength(1);
  });

  test("the scrim catches the tap (it does not let it through to the point zones)", () => {
    const onDismiss = vi.fn();
    const tree = SheetSurface({ placement: "bottom", onDismiss, children: null });
    const scrims = find(tree, (el) => el.props.onPress === onDismiss);
    expect(scrims).toHaveLength(1);
    expect(scrims[0]?.props.pointerEvents).not.toBe("none");
  });
});
