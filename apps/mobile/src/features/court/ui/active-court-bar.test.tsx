import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { ActiveCourtBar } from "./ActiveCourtBar";

vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable" }));
vi.mock("../../../theme/theme-context", () => ({
  useTheme: () => ({ tokens: { sizes: {}, spacing: {}, radii: {} }, colors: {} }),
}));
vi.mock("../../../ui/Text", () => ({ Text: "Text" }));

const COURT = {
  courtSessionId: "court-1",
  origin: { groupId: "g1", roundId: "r1" },
  score: { a: 18, b: 15 },
};

describe("ActiveCourtBar (Inicio.dc.html:88-95, R97 D1)", () => {
  test("one link to the court of the open match, with the group and the score", () => {
    const onOpen = vi.fn();
    const bar = ActiveCourtBar({
      court: COURT,
      groupName: "Racha de terça",
      onOpen,
    }) as ReactElement<{
      accessibilityRole: string;
      accessibilityLabel: string;
      onPress: () => void;
    }>;

    bar.props.onPress();

    expect(onOpen).toHaveBeenCalledWith("court-1");
    expect(bar.props.accessibilityRole).toBe("link");
    expect(bar.props.accessibilityLabel).toBe(
      "Partida aberta de Racha de terça, Laranja 18, Azul 15. Abrir quadra",
    );
  });

  test("the texts of the canvas", () => {
    const texts = strings.court.activeBar;
    expect(texts.label("Racha de terça")).toBe("EM QUADRA · Racha de terça");
    expect(texts.label(null)).toBe("EM QUADRA");
    expect(texts.score(18, 15)).toBe("Laranja 18 x 15 Azul");
    expect(texts.open).toBe("Abrir quadra");
    expect(strings.court.menu.leaveNote).toBe("A partida continua aberta neste celular.");
  });
});
