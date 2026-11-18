import type { CourtSessionTimeline, MatchStartedPayload } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { draftsFor } from "../session/command-drafts";
import { COURT_SESSION_ID } from "../session/court-harness.test.fixture";
import { runCourtReplay } from "../session/court-replay";
import { selectCourtPhase, selectSetEnd, stateOfTimeline } from "./court-screen.selectors";
import type { SetEndModel } from "./court-screen.types";
import { canConfirmSetEnd, firstServerToSend, setEndView } from "./set-end-view";
import {
  ROSTER,
  confirmSet,
  score,
  startScenario,
  withScoring,
  type Scenario,
} from "./screen-scenarios.test.fixture";

const BEST_OF_FIVE = withScoring({ bestOf: 5, pointsPerSet: 25, tieBreakPoints: 15, winMargin: 2 });
const SET_FOR_A = "a".repeat(25);
const SET_FOR_B = "b".repeat(25);

function modelOf(timeline: CourtSessionTimeline): SetEndModel {
  const model = selectSetEnd(timeline, ROSTER);
  if (model === null) throw new Error("no set to confirm");
  return model;
}

/** Plays the sets in order, confirming all but the last one; each letter is who wins a set. */
async function playSets(input: MatchStartedPayload, winners: string): Promise<Scenario> {
  const scenario = await startScenario(input);
  const sets = [...winners];
  for (const [index, winner] of sets.entries()) {
    await score(scenario, winner === "a" ? SET_FOR_A : SET_FOR_B);
    if (index < sets.length - 1) await confirmSet(scenario, toss(scenario));
  }
  return scenario;
}

/** The deciding set always gets A from the toss in these scenarios. */
function toss(scenario: Scenario): "a" | undefined {
  return modelOf(scenario.timeline()).needsFirstServer ? "a" : undefined;
}

function servingTeamOf(scenario: Scenario) {
  return stateOfTimeline(scenario.timeline()).currentMatch?.currentSet?.servingTeam;
}

describe("screen 25 in a best of three (D5)", () => {
  test("after set 1 there is no toss and the other team serves the next set", async () => {
    const scenario = await playSets(withScoring(BEST_OF_FIVE.scoring), "a");
    const model = modelOf(scenario.timeline());
    expect(model).toMatchObject({
      needsFirstServer: false,
      nextFirstServer: "b",
      endsMatch: false,
    });
    expect(setEndView(model)).toEqual({
      title: "Fim do set 1?",
      outcome: "Laranja vence o set e faz 1–0",
      next: { kind: "alternate", text: "Próximo set: troca de lados e o Azul começa sacando" },
      confirmLabel: "Confirmar fim do set",
      canUndo: true,
    });
    expect(canConfirmSetEnd(model, null)).toBe(true);
  });

  test("at 1–1 the toss is required, and B chosen starts set 3 serving", async () => {
    const scenario = await playSets(withScoring({ ...BEST_OF_FIVE.scoring, bestOf: 3 }), "ab");
    const model = modelOf(scenario.timeline());
    expect(setEndView(model).next).toEqual({
      kind: "toss",
      text: "Set decisivo: sorteio de quem saca",
    });
    expect(canConfirmSetEnd(model, null)).toBe(false);
    expect(canConfirmSetEnd(model, "b")).toBe(true);
    expect(firstServerToSend(model, "b")).toBe("b");
    await confirmSet(scenario, firstServerToSend(model, "b"));
    expect(servingTeamOf(scenario)).toBe("b");
  });

  test("a common set never sends a first server, even with a toss left over", async () => {
    const scenario = await playSets(withScoring({ ...BEST_OF_FIVE.scoring, bestOf: 3 }), "a");
    expect(firstServerToSend(modelOf(scenario.timeline()), "a")).toBeUndefined();
  });

  test("winning 2–0 ends the match: no toss and the button says so", async () => {
    const scenario = await playSets(withScoring({ ...BEST_OF_FIVE.scoring, bestOf: 3 }), "aa");
    const view = setEndView(modelOf(scenario.timeline()));
    expect(view.next).toEqual({ kind: "match-end", text: "Laranja vence a partida 2–0" });
    expect(view.confirmLabel).toBe("Confirmar fim da partida");
  });
});

describe("screen 25 in a best of five and in one set", () => {
  test("2–1 asks no toss and 2–2 does", async () => {
    const twoOne = await playSets(BEST_OF_FIVE, "aba");
    expect(modelOf(twoOne.timeline()).needsFirstServer).toBe(false);
    const twoTwo = await playSets(BEST_OF_FIVE, "abab");
    expect(modelOf(twoTwo.timeline()).needsFirstServer).toBe(true);
  });

  test("one set: the confirmation ends the match without a toss", async () => {
    const scenario = await playSets(SAMPLE_MATCH_ONE_SET, "b");
    const model = modelOf(scenario.timeline());
    expect(model).toMatchObject({ endsMatch: true, needsFirstServer: false, setsAfter: { b: 1 } });
    expect(setEndView(model).confirmLabel).toBe("Confirmar fim da partida");
  });

  test("Trocar sacador at 0–0 of set 1 makes A serve the second set after B served the first", async () => {
    const scenario = await startScenario(withScoring({ ...BEST_OF_FIVE.scoring, bestOf: 3 }));
    await scenario.controller.dispatch({ type: "switch-serving-team" });
    await score(scenario, SET_FOR_A);
    expect(modelOf(scenario.timeline()).nextFirstServer).toBe("a");
  });
});

describe("the engine on both sides of pendência 17 (fixed, the engine unchanged)", () => {
  test("the deciding set confirmed without a first server alternates", async () => {
    const scenario = await playSets(withScoring({ ...BEST_OF_FIVE.scoring, bestOf: 3 }), "ab");
    const drafts = draftsFor({ type: "confirm-set-end" }, scenario.timeline());
    expect(drafts.ok && drafts.value[0]?.payload).toMatchObject({ nextSet: { firstServer: "a" } });
  });

  test("a common set confirmed with a first server takes it", async () => {
    const scenario = await playSets(withScoring({ ...BEST_OF_FIVE.scoring, bestOf: 3 }), "a");
    const drafts = draftsFor({ type: "confirm-set-end", firstServer: "a" }, scenario.timeline());
    expect(drafts.ok && drafts.value[0]?.payload).toMatchObject({ nextSet: { firstServer: "a" } });
  });
});

describe("a deciding confirmation stored half (match-pending, pendência 31)", () => {
  async function pending(): Promise<CourtSessionTimeline> {
    const scenario = await playSets(SAMPLE_MATCH_ONE_SET, "a");
    await confirmSet(scenario);
    const snapshot = scenario.controller.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("not ready");
    const replayed = runCourtReplay(COURT_SESSION_ID, snapshot.events.slice(0, -1));
    if (!replayed.ok) throw new Error("the log does not replay");
    return replayed.value;
  }

  test("the phase is match-pending and screen 25 asks to confirm the end of the match", async () => {
    const timeline = await pending();
    expect(selectCourtPhase(stateOfTimeline(timeline))).toBe("match-pending");
    const view = setEndView(modelOf(timeline));
    expect(view).toMatchObject({
      title: "Falta confirmar o fim da partida",
      confirmLabel: "Confirmar fim da partida",
      canUndo: false,
    });
  });

  test("confirming again stores only the MatchEnded", async () => {
    const drafts = draftsFor({ type: "confirm-set-end" }, await pending());
    expect(drafts.ok && drafts.value.map(({ type }) => type)).toEqual(["MatchEnded"]);
  });
});
