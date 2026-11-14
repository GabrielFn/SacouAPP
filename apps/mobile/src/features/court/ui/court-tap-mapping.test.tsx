import type { ReactElement, ReactNode } from "react";
import type { TeamSide } from "@sacou/match-engine";
import { describe, expect, test, vi } from "vitest";

import { CourtLandscape } from "./CourtLandscape";
import { TeamZone } from "./TeamZone";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Text: "Text" }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ colors: { background: "#000" } }),
}));
vi.mock("../model/screen-texts", () => ({
  dotColors: () => [],
  hintText: () => "",
  setsLabel: () => "",
}));
vi.mock("./TeamZone", () => ({ TeamZone: () => null }));
vi.mock("./NetColumn", () => ({ NetColumn: () => null }));
vi.mock("./CourtHeader", () => ({ CourtHeader: () => null }));
vi.mock("./BottomStrip", () => ({ BottomStrip: () => null }));

interface ZoneProps {
  readonly panel: { readonly id: TeamSide };
  readonly onPoint: () => void;
}

function zonesOf(node: ReactNode): ReactElement<ZoneProps>[] {
  if (Array.isArray(node)) return node.flatMap(zonesOf);
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<ZoneProps & { children?: ReactNode }>;
  const own = element.type === TeamZone ? [element] : [];
  return [...own, ...zonesOf(element.props.children)];
}

function render(inverted: boolean): { zones: ReactElement<ZoneProps>[]; points: TeamSide[] } {
  const points: TeamSide[] = [];
  const model = { teams: { a: { id: "a" }, b: { id: "b" } } };
  const tree = CourtLandscape({
    model,
    layout: { netWidth: 1 },
    onPoint: (side: TeamSide) => points.push(side),
    onUndo: () => undefined,
    onCorrect: () => undefined,
    onOpenMenu: () => undefined,
    inverted,
  } as never);
  return { zones: zonesOf(tree), points };
}

describe("landscape zone taps with the sides flipped", () => {
  test("not inverted: the left zone shows A and scores A, the right shows B and scores B", () => {
    const { zones, points } = render(false);
    expect(zones.map((zone) => zone.props.panel.id)).toEqual(["a", "b"]);
    zones[0]?.props.onPoint();
    zones[1]?.props.onPoint();
    expect(points).toEqual(["a", "b"]);
  });

  test("inverted: the left zone shows B and a tap on it scores B", () => {
    const { zones, points } = render(true);
    expect(zones.map((zone) => zone.props.panel.id)).toEqual(["b", "a"]);
    zones[0]?.props.onPoint();
    zones[1]?.props.onPoint();
    expect(points).toEqual(["b", "a"]);
  });
});
