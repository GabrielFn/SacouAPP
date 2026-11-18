import { getRecentPoints } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { ROSTER, score, screen09, startScenario } from "../model/screen-scenarios.test.fixture";
import {
  canShift,
  correctionsSubtitle,
  effectiveSelection,
  revertSheet,
  servingNotice,
  shiftOptions,
  timelineRows,
} from "./corrections-selectors";

const NO_ROTATION = { ...SAMPLE_MATCH_ONE_SET, rotations: { a: null, b: null } };

describe("the lines of screen 24 (set 2 at 18-15)", () => {
  test("ten lines, newest first, with the score after each point", async () => {
    const scenario = await screen09();
    const rows = timelineRows(scenario.timeline(), ROSTER, null);
    expect(rows).toHaveLength(10);
    expect(rows[0]?.scoreText).toBe("18–15");
    expect(rows[1]?.scoreText).toBe("17–15");
    expect(rows[0]?.selectable).toBe(false);
    expect(rows.slice(1).every(({ selectable }) => selectable)).toBe(true);
  });

  test("side-out lines carry the rotation, the others do not", async () => {
    const scenario = await screen09();
    const rows = timelineRows(scenario.timeline(), ROSTER, null);
    const sideOuts = rows.filter(({ sideOutText }) => sideOutText !== null);
    expect(sideOuts.length).toBeGreaterThan(0);
    for (const { sideOutText } of sideOuts) {
      expect(sideOutText).toMatch(/^Side-out · rot\. [1-6]$/);
    }
  });

  test("the subtitle says the set, the score and how many lines", async () => {
    const scenario = await screen09();
    expect(correctionsSubtitle(scenario.timeline(), ROSTER)).toBe(
      "2º set · Laranja 18–15 Azul · últimos 10 pontos",
    );
  });

  test("a set with three points lists three", async () => {
    const scenario = await startScenario();
    await score(scenario, "aab");
    expect(correctionsSubtitle(scenario.timeline(), ROSTER)).toBe(
      "1º set · Laranja 2–1 Azul · últimos 3 pontos",
    );
  });

  test("picking the third line strikes the two newer ones and marks it selected", async () => {
    const scenario = await screen09();
    const timeline = scenario.timeline();
    const third = getRecentPoints(timeline)[2];
    const rows = timelineRows(timeline, ROSTER, third?.eventId ?? null);
    expect(rows.map(({ willUndo }) => willUndo).slice(0, 4)).toEqual([true, true, false, false]);
    expect(rows[2]?.selected).toBe(true);
    expect(rows[0]?.accessibilityLabel).toContain("Será desfeito");
    expect(rows[2]?.accessibilityLabel).toContain("Selecionado");
  });

  test("the newest point and an event that left the timeline are not a selection", async () => {
    const scenario = await screen09();
    const timeline = scenario.timeline();
    const points = getRecentPoints(timeline);
    expect(effectiveSelection(timeline, points[0]?.eventId ?? null)).toBeNull();
    expect(effectiveSelection(timeline, "gone")).toBeNull();
    expect(effectiveSelection(timeline, points[4]?.eventId ?? null)).toBe(points[4]?.eventId);
  });

  test("a rotation that is off says who serves by team, and a side-out has no number", async () => {
    const scenario = await startScenario(NO_ROTATION);
    await score(scenario, "aab");
    const [newest, second] = timelineRows(scenario.timeline(), ROSTER, null);
    expect(second?.serveName).toBeNull();
    expect(second?.serveText).toMatch(/^Saque do /);
    expect(second?.sideOutText).toBeNull();
    expect(newest?.sideOutText).toBe("Side-out");
  });
});

describe("the sheet of going back", () => {
  test("shows the score, the serve and the points that will be erased", async () => {
    const scenario = await screen09();
    const timeline = scenario.timeline();
    const target = getRecentPoints(timeline)[3];
    const sheet = revertSheet(timeline, ROSTER, target?.eventId ?? null);
    expect(sheet?.currentScore).toBe("18–15");
    expect(sheet?.title).toBe(
      `Voltar o jogo para ${String(target?.score.a)}x${String(target?.score.b)}?`,
    );
    expect(sheet?.removedPointsText).toBe("3 pontos serão apagados.");
    expect(sheet?.serveText).toMatch(/^volta para o /);
    expect(sheet?.removedAlsoText).toBeNull();
  });

  test("a change of serve in between is told", async () => {
    const scenario = await screen09();
    const target = getRecentPoints(scenario.timeline())[0];
    await scenario.controller.dispatch({ type: "switch-serving-team" });
    const sheet = revertSheet(scenario.timeline(), ROSTER, target?.eventId ?? null);
    expect(sheet?.removedAlsoText).toBe("Também sai: 1 troca de saque.");
  });

  test("nothing without a pick, nothing for an unknown event", async () => {
    const scenario = await screen09();
    expect(revertSheet(scenario.timeline(), ROSTER, null)).toBeNull();
    expect(revertSheet(scenario.timeline(), ROSTER, "gone")).toBeNull();
  });
});

describe("Girar and Trocar sacador", () => {
  test("each team shows the zone it goes to", async () => {
    const scenario = await screen09();
    const options = shiftOptions(scenario.timeline(), ROSTER);
    expect(options).toHaveLength(2);
    expect(canShift(options)).toBe(true);
    for (const option of options) {
      expect(option.forwardText).toMatch(/rotação [1-6] → [1-6]/);
      expect(option.backwardText).toMatch(/rotação [1-6] → [1-6]/);
    }
  });

  test("without rotation on both sides the button goes away", async () => {
    const scenario = await startScenario(NO_ROTATION);
    expect(canShift(shiftOptions(scenario.timeline(), ROSTER))).toBe(false);
  });

  test("the serving line shows only right after the change, and says set start at 0-0", async () => {
    const scenario = await startScenario();
    expect(servingNotice(scenario.timeline(), ROSTER)).toBeNull();
    await scenario.controller.dispatch({ type: "switch-serving-team" });
    expect(servingNotice(scenario.timeline(), ROSTER)).toMatch(/^Agora o .* começa o set\.$/);
    await score(scenario, "a");
    expect(servingNotice(scenario.timeline(), ROSTER)).toBeNull();
    await scenario.controller.dispatch({ type: "switch-serving-team" });
    expect(servingNotice(scenario.timeline(), ROSTER)).toMatch(/^Agora saca o /);
  });
});
