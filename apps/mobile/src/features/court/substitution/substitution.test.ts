import type { MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  SAMPLE_LIBERO_ID,
  SAMPLE_MATCH_BEST_OF_THREE,
  SAMPLE_ORANGE_LINEUP,
} from "../dev/sample-match.data";
import { stateOfTimeline } from "../model/court-screen.selectors";
import {
  ROSTER,
  score,
  startScenario,
  type Scenario,
} from "../model/screen-scenarios.test.fixture";
import { canSubstitute, substitutionView } from "./substitution-selectors";
import {
  INITIAL_SUBSTITUTION,
  substitutionReducer,
  type SubstitutionAction,
  type SubstitutionState,
} from "./substitution.reducer";

const [PEDRO, , , MARCOS] = SAMPLE_ORANGE_LINEUP as readonly string[];
/** "Tati" in the sample roster: here she waits on the bench of Laranja. */
const TATI = SAMPLE_LIBERO_ID;
const MARCOS_SLOT = 4;

const WITH_BENCH: MatchStartedPayload = {
  ...SAMPLE_MATCH_BEST_OF_THREE,
  rotations: {
    a: SAMPLE_MATCH_BEST_OF_THREE.rotations.a && {
      ...SAMPLE_MATCH_BEST_OF_THREE.rotations.a,
      bench: [TATI],
    },
    b: SAMPLE_MATCH_BEST_OF_THREE.rotations.b,
  },
  teams: {
    a: { memberIds: [...SAMPLE_ORANGE_LINEUP, TATI] },
    b: SAMPLE_MATCH_BEST_OF_THREE.teams.b,
  },
};

const NO_ROTATION: MatchStartedPayload = {
  ...WITH_BENCH,
  rotations: { a: null, b: null },
};

function pick(...actions: readonly SubstitutionAction[]): SubstitutionState {
  return actions.reduce(substitutionReducer, INITIAL_SUBSTITUTION);
}

function lineupOf(scenario: Scenario) {
  return stateOfTimeline(scenario.timeline()).currentMatch?.rotations.a;
}

describe("the reducer of screen 23a", () => {
  test("another team starts the picks over; the same team keeps them", () => {
    const picked = pick(
      { type: "outgoing-chosen", memberId: MARCOS ?? "" },
      { type: "incoming-chosen", memberId: TATI },
    );
    expect(substitutionReducer(picked, { type: "team-chosen", team: "b" })).toEqual({
      team: "b",
      outgoing: null,
      incoming: null,
      refusal: null,
    });
    const onA = substitutionReducer(picked, { type: "team-chosen", team: "a" });
    expect(substitutionReducer(onA, { type: "team-chosen", team: "a" })).toBe(onA);
  });

  test("a refusal stays until the next pick", () => {
    const refused = pick({ type: "command-refused", text: "não" });
    expect(refused.refusal).toBe("não");
    expect(
      substitutionReducer(refused, { type: "outgoing-chosen", memberId: PEDRO ?? "" }).refusal,
    ).toBeNull();
  });
});

describe("screen 23a: someone of the bench takes a position (question 79)", () => {
  test("Marcos out, Tati in: the sentence of the canvas and the button", async () => {
    const scenario = await startScenario(WITH_BENCH);
    const view = substitutionView(
      scenario.timeline(),
      ROSTER,
      pick(
        { type: "outgoing-chosen", memberId: MARCOS ?? "" },
        { type: "incoming-chosen", memberId: TATI },
      ),
    );
    expect(view?.team).toBe("a");
    expect(view?.teams.map(({ label }) => label)).toEqual(["Laranja"]);
    expect(view?.sentence).toBe(
      "Tati entra na posição 4, no lugar de Marcos. Marcos vai para o banco.",
    );
    expect(view?.confirmLabel).toBe("Trocar Marcos por Tati");
    expect(view?.incoming.map(({ name, detail }) => `${name} ${detail}`)).toEqual(["Tati banco"]);
  });

  test("who goes out shows the position, who serves and who sets", async () => {
    const scenario = await startScenario(WITH_BENCH);
    const view = substitutionView(scenario.timeline(), ROSTER, INITIAL_SUBSTITUTION);
    expect(view?.outgoing.map(({ detail }) => detail)).toEqual([
      "pos 1 · sacando · levantador",
      "pos 2",
      "pos 3",
      "pos 4",
      "pos 5",
      "pos 6",
    ]);
    expect(view?.picks).toBeNull();
    expect(view?.sentence).toBeNull();
  });

  test("the command puts Tati in the place of Marcos and Marcos at the end of the bench", async () => {
    const scenario = await startScenario(WITH_BENCH);
    const zone = lineupOf(scenario)?.setterZone;
    const result = await scenario.controller.dispatch({
      type: "substitute-player",
      team: "a",
      outgoing: MARCOS ?? "",
      incoming: TATI,
    });
    expect(result.ok).toBe(true);
    const after = lineupOf(scenario);
    expect(after?.lineup[MARCOS_SLOT - 1]).toBe(TATI);
    expect(after?.bench).toEqual([MARCOS]);
    expect(after?.setterZone).toBe(zone);
  });

  test("the server going out: who comes in serves at once and sets", async () => {
    const scenario = await startScenario(WITH_BENCH);
    await scenario.controller.dispatch({
      type: "substitute-player",
      team: "a",
      outgoing: PEDRO ?? "",
      incoming: TATI,
    });
    const view = substitutionView(scenario.timeline(), ROSTER, INITIAL_SUBSTITUTION);
    expect(view?.outgoing[0]).toMatchObject({
      name: "Tati",
      detail: "pos 1 · sacando · levantador",
    });
  });

  test("a pick that left the lineup or the bench is dropped on read", async () => {
    const scenario = await startScenario(WITH_BENCH);
    const state = pick(
      { type: "outgoing-chosen", memberId: MARCOS ?? "" },
      { type: "incoming-chosen", memberId: TATI },
    );
    await scenario.controller.dispatch({
      type: "substitute-player",
      team: "a",
      outgoing: MARCOS ?? "",
      incoming: TATI,
    });
    const view = substitutionView(scenario.timeline(), ROSTER, state);
    expect(view?.picks).toBeNull();
    expect(view?.incoming.map(({ name }) => name)).toEqual(["Marcos"]);
  });

  test("the queue never comes in: only the bench is offered", async () => {
    const scenario = await startScenario(WITH_BENCH);
    const view = substitutionView(scenario.timeline(), ROSTER, INITIAL_SUBSTITUTION);
    expect(view?.incoming.map(({ name }) => name)).toEqual(["Tati"]);
    const queue = SAMPLE_MATCH_BEST_OF_THREE.queue.players;
    expect(view?.incoming.some(({ memberId }) => queue.includes(memberId))).toBe(false);
  });

  test("the same member on both sides is refused by the engine", async () => {
    const scenario = await startScenario(WITH_BENCH);
    expect(
      await scenario.controller.dispatch({
        type: "substitute-player",
        team: "a",
        outgoing: MARCOS ?? "",
        incoming: MARCOS ?? "",
      }),
    ).toEqual({ ok: false, error: { code: "refused", reason: "invalid-payload" } });
  });

  test("an empty bench, or the rotation off, turns the item of the menu off", async () => {
    const empty = await startScenario();
    expect(canSubstitute(empty.timeline())).toBe(false);
    expect(substitutionView(empty.timeline(), ROSTER, INITIAL_SUBSTITUTION)).toBeNull();
    const off = await startScenario(NO_ROTATION);
    expect(canSubstitute(off.timeline())).toBe(false);
    const withBench = await startScenario(WITH_BENCH);
    expect(canSubstitute(withBench.timeline())).toBe(true);
  });

  test("still works in the middle of the set", async () => {
    const scenario = await startScenario(WITH_BENCH);
    await score(scenario, "abab");
    expect(canSubstitute(scenario.timeline())).toBe(true);
  });
});
