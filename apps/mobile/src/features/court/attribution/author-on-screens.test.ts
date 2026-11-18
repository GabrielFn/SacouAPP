import { getRecentPoints, previewRevert } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET, SAMPLE_ORANGE_LINEUP } from "../dev/sample-match.data";
import { timelineRows } from "../corrections/corrections-selectors";
import {
  ROSTER,
  score,
  startScenario,
  type Scenario,
} from "../model/screen-scenarios.test.fixture";
import { scoredPointId } from "./scored-point";
import { setEndAttribution } from "./set-end-attribution";

const [PEDRO] = SAMPLE_ORANGE_LINEUP as readonly string[];

function pointIds(scenario: Scenario): readonly string[] {
  return getRecentPoints(scenario.timeline()).map(({ eventId }) => eventId);
}

describe("the author on screen 24 (D10)", () => {
  test("each line says who scored it, an error of the opponent, or nobody", async () => {
    const scenario = await startScenario();
    await score(scenario, "aab");
    const [blue, second, first] = pointIds(scenario);
    await scenario.controller.dispatch({
      type: "attribute-point",
      pointEventId: first ?? "",
      authorship: { kind: "attack", author: PEDRO ?? null },
    });
    await scenario.controller.dispatch({
      type: "attribute-point",
      pointEventId: blue ?? "",
      authorship: { kind: "opponent-error", author: null },
    });
    const rows = timelineRows(scenario.timeline(), ROSTER, null, true);
    expect(rows.map(({ authorText }) => authorText)).toEqual([
      "Erro do Laranja",
      "sem autor",
      "Ataque · Pedro",
    ]);
    expect(rows.find(({ eventId }) => eventId === second)?.accessibilityLabel).toContain(
      "sem autor",
    );
  });

  test("with the option off the lines have no author", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    expect(
      timelineRows(scenario.timeline(), ROSTER, null).map(({ authorText }) => authorText),
    ).toEqual([null]);
  });

  test("going back to an earlier point counts the answer it takes away", async () => {
    const scenario = await startScenario();
    await score(scenario, "aa");
    const [newest, oldest] = pointIds(scenario);
    await scenario.controller.dispatch({
      type: "attribute-point",
      pointEventId: newest ?? "",
      authorship: { kind: "attack", author: PEDRO ?? null },
    });
    const preview = previewRevert(scenario.timeline(), oldest ?? "");
    expect(preview.ok && preview.value.removed.attributions).toBe(1);
  });
});

describe("the points without an author on screen 25 (D10)", () => {
  test("every point of the set without an author, oldest first; filling them in hides the line", async () => {
    const scenario = await startScenario();
    const first = await scenario.controller.dispatch({ type: "score-point", team: "a" });
    await score(scenario, "a".repeat(24));
    const model = setEndAttribution(scenario.timeline(), true);
    expect(model?.text).toBe("25 pontos sem autor");
    expect(model?.pointEventIds[0]).toBe(first.ok ? scoredPointId(first.value.written) : null);
    expect(model?.lastChance).toBeNull();
    for (const pointEventId of model?.pointEventIds ?? []) {
      await scenario.controller.dispatch({
        type: "attribute-point",
        pointEventId,
        authorship: { kind: "opponent-error", author: null },
      });
    }
    expect(setEndAttribution(scenario.timeline(), true)).toBeNull();
  });

  test("the set that closes the match is the last chance; with the option off, nothing", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, "a".repeat(25));
    expect(setEndAttribution(scenario.timeline(), true)?.lastChance).toBe(
      "Última chance: depois de confirmar, a partida fecha.",
    );
    expect(setEndAttribution(scenario.timeline(), false)).toBeNull();
  });

  test("one point says it in the singular", async () => {
    const scenario = await startScenario();
    await score(scenario, "a".repeat(25));
    const ids = setEndAttribution(scenario.timeline(), true)?.pointEventIds ?? [];
    for (const pointEventId of ids.slice(1)) {
      await scenario.controller.dispatch({
        type: "attribute-point",
        pointEventId,
        authorship: { kind: "opponent-error", author: null },
      });
    }
    expect(setEndAttribution(scenario.timeline(), true)?.text).toBe("1 ponto sem autor");
  });
});

describe("the point a command wrote", () => {
  test("a point gives its id; an answer gives none", async () => {
    const scenario = await startScenario();
    const scored = await scenario.controller.dispatch({ type: "score-point", team: "a" });
    const id = scored.ok ? scoredPointId(scored.value.written) : null;
    expect(id).toBe(pointIds(scenario)[0]);
    const answered = await scenario.controller.dispatch({
      type: "attribute-point",
      pointEventId: id ?? "",
      authorship: { kind: "attack", author: PEDRO ?? null },
    });
    expect(answered.ok ? scoredPointId(answered.value.written) : "refused").toBeNull();
  });
});
