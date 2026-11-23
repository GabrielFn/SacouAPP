import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { LoadedBody, ProfileActions } from "./ProfileScreen";
import { STAT_LABEL_LINES, StatTile } from "./StatTile";

const BUTTON = vi.hoisted(() => function Button() {});
const TEXT = vi.hoisted(() => function Text() {});

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ colors: {}, tokens: { spacing: {}, borderWidths: {}, radii: {} } }),
}));
vi.mock("../../../ui/Button", () => ({ Button: BUTTON }));
vi.mock("../../../ui/Text", () => ({ Text: TEXT }));
vi.mock("../../../ui/Icons", () => ({ LockIcon: () => null }));
vi.mock("../../../ui/MenuIcons", () => ({ GearIcon: () => null, ShareIcon: () => null }));
vi.mock("../../../ui/EmptyState", () => ({ EmptyState: () => null }));
vi.mock("../../../ui/LoadingState", () => ({ LoadingState: () => null }));
vi.mock("../../../ui/OfflineBanner", () => ({ OfflineBanner: () => null }));
vi.mock("../../../ui/Screen", () => ({ Screen: () => null }));
vi.mock("../hooks/use-profile-view", () => ({ useProfileView: () => ({}) }));
vi.mock("./PlayerCardView", () => ({ PlayerCardView: () => null }));
vi.mock("./GroupStatsRow", () => ({ GroupStatsRow: () => null }));
vi.mock("../model/player-card", () => ({
  playerCardOf: () => ({ nickname: "Org" }),
  positionLineOf: () => null,
  statTilesOf: () => [],
}));
vi.mock("../model/group-stats", () => ({ groupRowsOf: () => [] }));

type Props = {
  readonly children?: ReactNode;
  readonly style?: { readonly flexDirection?: string };
  readonly label?: string;
  readonly numberOfLines?: number;
};

function propsOf(node: ReactNode, type: unknown): readonly Props[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => propsOf(child, type));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Props>;
  return [
    ...(element.type === type ? [element.props] : []),
    ...propsOf(element.props.children, type),
  ];
}

describe("the texts of the card tab fit (R99 S4, criteria 15 and 16)", () => {
  test("the stat label may take two lines, so '1.3' fonts do not cut it with '..'", () => {
    const tile = { key: "wins", value: "3", label: "vitórias · 50%" } as never;
    const [label] = propsOf(StatTile({ tile }), TEXT).filter(
      (props) => props.children === "vitórias · 50%",
    );
    expect(STAT_LABEL_LINES).toBeGreaterThanOrEqual(2);
    expect(label?.numberOfLines).toBe(STAT_LABEL_LINES);
  });

  test("'Compartilhar' keeps the canvas label and sits in its own full-width block", () => {
    const labels = propsOf(
      ProfileActions({ onShare: () => undefined, onEditProfile: () => undefined }),
      BUTTON,
    );
    expect(labels.map((props) => props.label)).toEqual([
      strings.profile.me.share,
      strings.profile.me.editProfile,
    ]);
    expect(strings.profile.me.share).toBe("Compartilhar");
  });

  test("the buttons sit under the card, not in the narrow column beside it (Gabriel, 23/11, ADR 0077)", () => {
    const view = { kind: "empty", stale: false, profile: {}, stats: {} } as never;
    const tree = LoadedBody({
      view,
      accountName: "Org",
      onShare: () => undefined,
      onEditProfile: () => undefined,
    });
    expect(insideRow(tree, ProfileActions, false)).toBe(false);
    expect(propsOf(tree, ProfileActions)).toHaveLength(1);
  });
});

/** Whether `type` is rendered inside a View laid out as a row (the card and its side column). */
function insideRow(node: ReactNode, type: unknown, inRow: boolean): boolean {
  if (Array.isArray(node)) return node.some((child: ReactNode) => insideRow(child, type, inRow));
  if (!isValidElement(node)) return false;
  const element = node as ReactElement<Props>;
  if (element.type === type) return inRow;
  const row = inRow || element.props.style?.flexDirection === "row";
  return insideRow(element.props.children, type, row);
}
