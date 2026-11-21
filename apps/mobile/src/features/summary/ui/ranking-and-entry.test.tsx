import type { ReactElement, ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";

import { ErrorStrip } from "../../../ui/ErrorStrip";
import type { RankingRowView } from "../model/beach-ranking-view";
import { RankingList } from "./RankingList";
import { VotingEntry } from "./VotingEntry";

const TOUCH_FLOOR = 44;
const ROW_MIN = 48;
const LONG_NAME = "Maria Eduarda e Ana Luísa";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));
vi.mock("../../../ui/Button", () => ({ Button: "Button" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({
    colors: {
      surface: "#fff",
      borderCard: "#ccc",
      borderDivider: "#eee",
      textMuted: "#444",
      text: "#000",
      waitingFill: "#ff0",
      waitingBorder: "#cc0",
    },
    tokens: {
      radii: { tile: 16, field: 12 },
      spacing: { xs: 4, s6: 6, m: 12, s14: 14, xxl: 24 },
      borderWidths: { thin: 1.5 },
      sizes: { iconButton: ROW_MIN, minTouchTarget: TOUCH_FLOOR },
    },
  }),
}));

type Node = ReactElement<{
  children?: ReactNode;
  style?: Record<string, unknown>;
  onPress?: () => void;
  accessibilityRole?: string;
}>;

function all(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap((child: ReactNode) => all(child));
  if (node === null || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Node;
  return [element, ...all(element.props.children)];
}

function row(position: number, name: string): RankingRowView {
  return {
    position,
    key: name,
    name,
    record: "7 vitórias · 2 derrotas",
    wins: 7,
    losses: 2,
    accessibilityLabel: `${String(position)}º, ${name}`,
  };
}

describe("RankingList (L1)", () => {
  const rows = [row(1, LONG_NAME), row(2, "Caio e Léo")];

  test("a list whose rows are at least the touch floor, with no fixed width or height", () => {
    const nodes = all(RankingList({ rows }));
    expect(nodes.some((node) => node.props.accessibilityRole === "list")).toBe(true);
    const lines = nodes.filter((node) => node.props.style?.minHeight === ROW_MIN);
    expect(lines).toHaveLength(rows.length);
    expect(ROW_MIN).toBeGreaterThanOrEqual(TOUCH_FLOOR);
    for (const box of nodes.filter((node) => node.type === "View")) {
      expect(box.props.style).not.toHaveProperty("width");
      expect(box.props.style).not.toHaveProperty("height");
    }
  });

  test("without rows nothing is drawn", () => {
    expect(RankingList({ rows: [] })).toBeNull();
  });
});

describe("VotingEntry (E1 to E6)", () => {
  const noop = () => undefined;

  test("hidden draws nothing; the other forms show only their own text", () => {
    expect(VotingEntry({ entry: { kind: "hidden" }, onVote: noop })).toBeNull();
    const voted = VotingEntry({
      entry: { kind: "voted", text: "Você já votou · resultado em 23 h" },
      onVote: noop,
    });
    expect(all(voted)[0]?.props.children).toBe("Você já votou · resultado em 23 h");
    const notOpen = VotingEntry({ entry: { kind: "not-open", text: "abre depois" }, onVote: noop });
    expect(notOpen?.type).toBe("Text");
  });

  test("the vote button calls the screen", () => {
    const onVote = vi.fn();
    const button = VotingEntry({ entry: { kind: "vote", label: "Votar no MVP" }, onVote });
    expect(button?.type).toBe("Button");
    (button as Node).props.onPress?.();
    expect(onVote).toHaveBeenCalledOnce();
  });
});

describe("ErrorStrip with a way to close", () => {
  test("the button has the touch floor and calls the screen", () => {
    const onDismiss = vi.fn();
    const nodes = all(ErrorStrip({ text: "Erro", dismissLabel: "Fechar", onDismiss }));
    const button = nodes.find((node) => node.props.accessibilityRole === "button");
    expect(button?.props.style?.minHeight).toBe(TOUCH_FLOOR);
    button?.props.onPress?.();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test("without the label there is no button", () => {
    const nodes = all(ErrorStrip({ text: "Erro" }));
    expect(nodes.some((node) => node.props.accessibilityRole === "button")).toBe(false);
  });
});
