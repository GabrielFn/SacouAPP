import { describe, expect, test } from "vitest";

import { describeUndo, undoNoticeText } from "./undo-notice";
import { ROSTER, confirmSet, score, screen09, startScenario } from "./screen-scenarios.test.fixture";

const label = (side: "a" | "b") => ROSTER.teamAppearance("any", side).label;

describe("the line that says what DESFAZER took back", () => {
  test("a point: the team and the score after it", async () => {
    const scenario = await screen09();
    const notice = describeUndo(scenario.timeline());
    expect(notice).toMatchObject({ kind: "point", team: "a", score: { a: 18, b: 15 } });
    expect(notice && undoNoticeText(notice, label)).toBe("Desfeito: ponto do Laranja (18–15)");
  });

  test("a change of serve", async () => {
    const scenario = await screen09();
    await scenario.controller.dispatch({ type: "switch-serving-team" });
    const notice = describeUndo(scenario.timeline());
    expect(notice && undoNoticeText(notice, label)).toBe("Desfeito: troca de saque");
  });

  test("a turn of the rotation names the team", async () => {
    const scenario = await screen09();
    await scenario.controller.dispatch({ type: "shift-rotation", team: "b", direction: "forward" });
    const notice = describeUndo(scenario.timeline());
    expect(notice && undoNoticeText(notice, label)).toBe("Desfeito: giro do Azul");
  });

  test("the end of a set", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    const notice = describeUndo(scenario.timeline());
    expect(notice && undoNoticeText(notice, label)).toBe("Desfeito: fim do set");
  });

  test("nothing to say right after the start of the match", async () => {
    const scenario = await startScenario();
    expect(describeUndo(scenario.timeline())).toBeNull();
  });
});
