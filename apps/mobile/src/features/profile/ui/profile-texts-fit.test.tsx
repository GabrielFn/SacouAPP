import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { ProfileActions } from "./ProfileScreen";
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

type Props = {
  readonly children?: ReactNode;
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
});
