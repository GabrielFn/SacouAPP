import {
  getRecentPoints,
  getUnattributedPoints,
  POINT_SCORED_EVENT_TYPE,
  type PointAuthorship,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  SAMPLE_LIBERO_ID,
  SAMPLE_MATCH_WITH_LIBERO,
  SAMPLE_ORANGE_LINEUP,
} from "../dev/sample-match.data";
import { SAMPLE_LIBERO_NAME } from "../dev/sample-names.data";
import {
  ROSTER,
  score,
  startScenario,
  type Scenario,
} from "../model/screen-scenarios.test.fixture";
import { attributionSheet } from "./attribution-selectors";
import {
  attributionReducer,
  CLOSED_ATTRIBUTION,
  type AttributionAction,
  type AttributionState,
  type AuthoredPointKind,
} from "./attribution.reducer";

const [PEDRO, ANA] = SAMPLE_ORANGE_LINEUP;

function eventsOf(scenario: Scenario) {
  const snapshot = scenario.controller.getSnapshot();
  return snapshot.status === "ready" ? snapshot.events : [];
}

function lastPointId(scenario: Scenario): string {
  const point = eventsOf(scenario)
    .filter(({ type }) => type === POINT_SCORED_EVENT_TYPE)
    .at(-1);
  if (point === undefined) throw new Error("no point");
  return point.eventId;
}

function asking(pointEventId: string, kind: AuthoredPointKind = "attack"): AttributionState {
  return [
    { type: "opened", pointEventIds: [pointEventId] },
    { type: "kind-chosen", kind },
  ].reduce<AttributionState>(
    (state, action) => attributionReducer(state, action as AttributionAction),
    CLOSED_ATTRIBUTION,
  );
}

async function answer(scenario: Scenario, pointEventId: string, authorship: PointAuthorship) {
  return scenario.controller.dispatch({ type: "attribute-point", pointEventId, authorship });
}

function sheetOf(scenario: Scenario, state: AttributionState) {
  return attributionSheet(scenario.timeline(), ROSTER, state);
}

describe("the reducer of screen 31", () => {
  test("opens on the first point with Ataque, and goes through the others in order", () => {
    let state = attributionReducer(CLOSED_ATTRIBUTION, {
      type: "opened",
      pointEventIds: ["p1", "p2"],
    });
    expect(state).toEqual({
      status: "open",
      pointEventId: "p1",
      kind: "attack",
      next: ["p2"],
      refusal: null,
    });
    state = attributionReducer(state, { type: "answered" });
    expect(state).toMatchObject({ pointEventId: "p2", next: [] });
    expect(attributionReducer(state, { type: "skipped" })).toEqual(CLOSED_ATTRIBUTION);
  });

  test("a new point replaces the question; nothing to ask closes it", () => {
    const open = attributionReducer(CLOSED_ATTRIBUTION, { type: "opened", pointEventIds: ["p1"] });
    expect(attributionReducer(open, { type: "opened", pointEventIds: ["p2"] })).toMatchObject({
      pointEventId: "p2",
    });
    expect(attributionReducer(open, { type: "opened", pointEventIds: [] })).toEqual(
      CLOSED_ATTRIBUTION,
    );
    expect(attributionReducer(open, { type: "closed" })).toEqual(CLOSED_ATTRIBUTION);
  });

  test("a refusal stays until another kind; a closed sheet ignores the rest", () => {
    const refused = attributionReducer(asking("p1"), { type: "command-refused", text: "não" });
    expect(refused).toMatchObject({ refusal: "não" });
    expect(attributionReducer(refused, { type: "kind-chosen", kind: "ace" })).toMatchObject({
      kind: "ace",
      refusal: null,
    });
    expect(attributionReducer(CLOSED_ATTRIBUTION, { type: "answered" })).toBe(CLOSED_ATTRIBUTION);
  });
});

describe("screen 31: who of the rally scored", () => {
  test("Laranja serving: the six of the rally, front row first, Pedro served and sets", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const sheet = sheetOf(scenario, asking(lastPointId(scenario)));
    expect(sheet?.title).toBe("Ponto do Laranja · 1–0");
    expect(sheet?.teamOnCourt).toBe("Laranja em quadra");
    expect(sheet?.opponentError).toBe("Erro do Azul");
    expect(sheet?.players.map(({ name, detail }) => `${name} ${detail ?? ""}`)).toEqual([
      "Ana pos 2",
      "Lia pos 3",
      "Marcos pos 4",
      "Pedro pos 1 · sacou",
      "João pos 6",
      "Bia pos 5",
    ]);
    expect(sheet?.players.find(({ name }) => name === "Pedro")?.badge).toBe("L");
  });

  test("Ace leaves only the server of the rally on; a team that received has no Ace", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const ace = sheetOf(scenario, asking(lastPointId(scenario), "ace"));
    expect(ace?.players.filter(({ enabled }) => enabled).map(({ name }) => name)).toEqual([
      "Pedro",
    ]);
    await score(scenario, "b");
    const received = sheetOf(scenario, asking(lastPointId(scenario)));
    expect(received?.kinds.find(({ kind }) => kind === "ace")?.enabled).toBe(false);
    expect(received?.kinds.find(({ kind }) => kind === "attack")?.enabled).toBe(true);
  });

  test("Bloqueio leaves the libero off", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_WITH_LIBERO);
    await score(scenario, "a");
    const block = sheetOf(scenario, asking(lastPointId(scenario), "block"));
    const libero = block?.players.find(({ memberId }) => memberId === SAMPLE_LIBERO_ID);
    expect(libero).toMatchObject({ name: SAMPLE_LIBERO_NAME, badge: "Lí", enabled: false });
    expect(libero?.accessibilityLabel).toContain("não combina com o tipo");
    const attack = sheetOf(scenario, asking(lastPointId(scenario)));
    expect(attack?.players.find(({ memberId }) => memberId === SAMPLE_LIBERO_ID)?.enabled).toBe(
      true,
    );
  });

  test("turning the rotation after the point does not change the players of the rally", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = lastPointId(scenario);
    const before = sheetOf(scenario, asking(pointId))?.players;
    await scenario.controller.dispatch({ type: "shift-rotation", team: "a", direction: "forward" });
    expect(sheetOf(scenario, asking(pointId))?.players).toEqual(before);
  });

  test("an undone point closes the sheet on read", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = lastPointId(scenario);
    await scenario.controller.dispatch({ type: "undo" });
    expect(sheetOf(scenario, asking(pointId))).toBeNull();
    expect(sheetOf(scenario, CLOSED_ATTRIBUTION)).toBeNull();
  });
});

describe("answering screen 31 (ADR 0031)", () => {
  test("Ataque of Ana records one PointAttributed with only IDs", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = lastPointId(scenario);
    const result = await answer(scenario, pointId, { kind: "attack", author: ANA ?? null });
    expect(result.ok).toBe(true);
    const written = result.ok ? result.value.written : [];
    expect(written.map(({ type }) => type)).toEqual(["PointAttributed"]);
    expect(Object.keys(written[0]?.payload ?? {}).sort()).toEqual([
      "author",
      "kind",
      "matchId",
      "pointEventId",
    ]);
    // No name of the roster ever reaches the log.
    const log = JSON.stringify(eventsOf(scenario));
    ["Ana", "Pedro", "Laranja", "Azul"].forEach((name) => {
      expect(log).not.toContain(name);
    });
    expect(getRecentPoints(scenario.timeline())[0]).toMatchObject({ author: ANA, kind: "attack" });
  });

  test("Erro do Azul has no author; an ace of someone else is refused, not recorded", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = lastPointId(scenario);
    const events = eventsOf(scenario).length;
    expect(await answer(scenario, pointId, { kind: "ace", author: ANA ?? null })).toEqual({
      ok: false,
      error: { code: "refused", reason: "invalid-point-author" },
    });
    expect(eventsOf(scenario)).toHaveLength(events);
    await answer(scenario, pointId, { kind: "opponent-error", author: null });
    expect(getRecentPoints(scenario.timeline())[0]).toMatchObject({
      author: null,
      kind: "opponent-error",
    });
  });

  test("Desfazer takes the answer back first, then the point", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = lastPointId(scenario);
    await answer(scenario, pointId, { kind: "attack", author: PEDRO ?? null });
    await scenario.controller.dispatch({ type: "undo" });
    expect(getRecentPoints(scenario.timeline())[0]).toMatchObject({ eventId: pointId, kind: null });
    await scenario.controller.dispatch({ type: "undo" });
    expect(getRecentPoints(scenario.timeline())).toEqual([]);
  });

  test("a new answer from screen 24 wins over the first", async () => {
    const scenario = await startScenario();
    await score(scenario, "a");
    const pointId = lastPointId(scenario);
    await answer(scenario, pointId, { kind: "attack", author: PEDRO ?? null });
    await answer(scenario, pointId, { kind: "block", author: ANA ?? null });
    expect(getRecentPoints(scenario.timeline())[0]).toMatchObject({ author: ANA, kind: "block" });
  });

  test("screen 25: three points without an author, and filling them in empties the list", async () => {
    const scenario = await startScenario();
    await score(scenario, "aaa");
    const unattributed = getUnattributedPoints(scenario.timeline()).map(({ eventId }) => eventId);
    expect(unattributed).toHaveLength(3);
    for (const pointEventId of unattributed) {
      await answer(scenario, pointEventId, { kind: "attack", author: ANA ?? null });
    }
    expect(getUnattributedPoints(scenario.timeline())).toEqual([]);
  });
});
