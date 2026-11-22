import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { groupCardModel } from "../model/groups-list.selectors";
import { GroupCard } from "./GroupCard";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ colors: {}, tokens: { sizes: {}, spacing: {}, borderWidths: {}, radii: {} } }),
}));
vi.mock("../../../ui/RoleBadge", () => ({ RoleBadge: () => null }));
vi.mock("../../../ui/Text", () => ({ Text: () => null }));
vi.mock("../../rounds/ui/RoundCardStatus", () => ({ RoundCardStatus: () => null }));
vi.mock("./DayStrip", () => ({ DayStrip: () => null }));

interface PressableProps {
  readonly accessibilityHint?: string;
  readonly onPress: () => void;
  readonly children?: ReactNode;
}

function pressablesIn(node: ReactNode): readonly PressableProps[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => pressablesIn(child));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<PressableProps>;
  const own = element.type === "Pressable" ? [element.props] : [];
  return [...own, ...pressablesIn(element.props.children)];
}

const GROUP = { groupId: "g1", name: "Racha", role: "admin", memberType: "regular" } as const;

describe("GroupCard: the body leads to the rounds of the group (R97 part 2, D3)", () => {
  test("touching a card without a round calls onOpenGroup with the groupId", () => {
    const onOpenGroup = vi.fn();
    const [body] = pressablesIn(
      GroupCard({
        model: groupCardModel(GROUP),
        round: null,
        actions: [],
        onAction: vi.fn(),
        onOpenGroup,
      }),
    );
    expect(body?.accessibilityHint).toBe("Ver as rodadas do grupo");
    body?.onPress();
    expect(onOpenGroup).toHaveBeenCalledWith("g1");
  });

  test("the footer actions stay and do not open the group", () => {
    const onOpenGroup = vi.fn();
    const onAction = vi.fn();
    const found = pressablesIn(
      GroupCard({
        model: groupCardModel(GROUP),
        round: null,
        actions: ["members", "createRound"],
        onAction,
        onOpenGroup,
      }),
    );
    expect(found).toHaveLength(3);
    found[2]?.onPress();
    expect(onAction).toHaveBeenCalledWith("createRound", "g1");
    expect(onOpenGroup).not.toHaveBeenCalled();
  });
});
