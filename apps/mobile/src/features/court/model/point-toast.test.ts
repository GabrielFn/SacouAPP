import { describe, expect, test } from "vitest";

import { selectCourtScreen } from "./court-screen.selectors";
import { selectLastPoint } from "./point-toast";
import { ROSTER, score, screen09, startScenario } from "./screen-scenarios.test.fixture";
import { pointToastText } from "./screen-texts";

describe("the toast of the last point", () => {
  test("it says who scored and the score, theirs first: +1 Laranja (19–15)", async () => {
    const scenario = await screen09();
    await score(scenario, "a");
    const point = selectLastPoint(scenario.timeline());
    expect(point).toEqual({ side: "a", own: 19, other: 15 });
    const model = selectCourtScreen(scenario.timeline(), ROSTER);
    expect(model && point && pointToastText(model, point)).toBe("+1 Laranja (19–15)");
  });

  test("a point of Azul puts the Azul score first", async () => {
    const scenario = await screen09();
    await score(scenario, "b");
    const point = selectLastPoint(scenario.timeline());
    const model = selectCourtScreen(scenario.timeline(), ROSTER);
    expect(model && point && pointToastText(model, point)).toBe("+1 Azul (16–18)");
  });

  test("there is none before the first point", async () => {
    const scenario = await startScenario();
    expect(selectLastPoint(scenario.timeline())).toBeNull();
  });

  test("an undo leaves the earlier point as the last one: the guard hides the toast then", async () => {
    const scenario = await startScenario();
    await score(scenario, "ab");
    await scenario.controller.dispatch({ type: "undo" });
    expect(selectLastPoint(scenario.timeline())).toEqual({ side: "a", own: 1, other: 0 });
  });
});
