import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { createScaledTokens } from "../../../theme/scale";
import { attributionReducer, CLOSED_ATTRIBUTION } from "../attribution/attribution.reducer";
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
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
vi.mock("../../../theme/theme-context", async () => {
  const { createScaledTokens: create } = await import("../../../theme/scale");
  const tokens = create({ windowWidth: 360, fontScale: 1 });
  return { useTheme: () => ({ tokens, colors: {} }), ThemeProvider: "ThemeProvider" };
});
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../ui/Icons", () => ({ AlertCircleIcon: "Icon", CheckIcon: "Icon" }));

interface Props {
  readonly children?: unknown;
  readonly style?: { readonly gap?: number; readonly paddingBottom?: number };
}

function collect(node: unknown, out: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (Array.isArray(node)) node.forEach((child) => collect(child, out));
  else if (typeof node === "object" && node !== null && "props" in node) {
    const element = node as ReactElement<Props>;
    out.push(element);
    collect(element.props.children, out);
  }
  return out;
}

const tokens = createScaledTokens({ windowWidth: 360, fontScale: 1 });

describe("wiring of the outside tap (screens 24 and 25)", () => {
  test("corrections route passes onClose of the sheet to AttributionSheet", () => {
    const source = readFileSync(
      new URL("../../../app/court/[courtSessionId]/corrections.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/onClose=\{attribution\.onClose\}/);
  });

  test("SetEndAttribution passes onClose of the sheet to AttributionSheet", () => {
    const source = readFileSync(new URL("./SetEndAttribution.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/onClose=\{sheet\.onClose\}/);
  });

  test("the hook answers onClose with the closed action, not skipped", () => {
    const source = readFileSync(
      new URL("../hooks/use-attribution-sheet.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/onClose: useCallback\(\(\) => \{\s*send\(\{ type: "closed" \}\);/);
  });

  test("closed drops the whole queue; skipped goes on to the next point", () => {
    const open = attributionReducer(CLOSED_ATTRIBUTION, {
      type: "opened",
      pointEventIds: ["p1", "p2", "p3"],
    });
    expect(attributionReducer(open, { type: "closed" })).toEqual(CLOSED_ATTRIBUTION);
    expect(attributionReducer(open, { type: "skipped" })).toMatchObject({ pointEventId: "p2" });
  });
});

describe("tight spacing on its side (780 x 360)", () => {
  test("the sheet blocks use spacing.s, never spacing.m", () => {
    const props = { model: {}, onSkip: vi.fn() } as unknown as AttributionSheetProps;
    const gaps = collect(AttributionSheet(props))
      .map((el) => el.props.style?.gap)
      .filter((gap): gap is number => gap !== undefined && gap !== tokens.spacing.xl);
    expect(gaps.length).toBeGreaterThan(0);
    expect(tokens.spacing.s).toBeLessThan(tokens.spacing.m);
    gaps.forEach((gap) => {
      expect(gap).toBe(tokens.spacing.s);
    });
  });

  test("the surface padding and gap are tight too, with the handle hidden", () => {
    const tree = collect(SheetSurface({ placement: "bottom", children: null }));
    const content = tree.find((el) => el.props.style?.paddingBottom !== undefined);
    expect(content?.props.style?.gap).toBe(tokens.spacing.s);
    expect(content?.props.style?.paddingBottom).toBe(24 + tokens.spacing.s);
  });
});
