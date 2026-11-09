import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_BEST_OF_THREE } from "../dev/sample-match.data";
import {
  COURT_SESSION_ID,
  createHarness,
  rallies,
  stateOf,
  type CourtHarness,
  type StorageKind,
} from "./court-harness.test.fixture";
import type { CourtSessionController } from "./court-session-controller";

const STORAGES: readonly StorageKind[] = ["memory", "sqlite"];
const FIRST_SET_WINNER_POINTS = { a: 25, b: 22 };

/** Kills the app: the controller is dropped and a new one reads the file again. */
async function reopen(harness: CourtHarness): Promise<CourtSessionController> {
  const controller = harness.openController();
  await controller.whenIdle();
  return controller;
}

async function expectSurvivesKill(
  harness: CourtHarness,
  controller: CourtSessionController,
): Promise<CourtSessionController> {
  const before = stateOf(harness, controller);
  const reopened = await reopen(harness);
  expect(stateOf(harness, reopened)).toEqual(before);
  return reopened;
}

async function ok(pending: ReturnType<CourtSessionController["dispatch"]>): Promise<void> {
  const result = await pending;
  expect(result).toEqual({ ok: true, value: undefined });
}

describe.each(STORAGES)("a whole best-of-three match played offline (%s)", (kind) => {
  test("points, three undos, set confirmations, the toss of the decider and the end", async () => {
    const harness = await createHarness(kind);
    const started = await harness.start(SAMPLE_MATCH_BEST_OF_THREE);
    expect(started).toEqual({ ok: true, value: { route: `/court/${COURT_SESSION_ID}` } });
    let controller = await reopen(harness);

    // Set 1. Undo 1 takes back a side-out (Azul scoring on the serve of Laranja), undo 2 a point.
    await rallies(controller, "a");
    const afterPoint = stateOf(harness, controller);
    await rallies(controller, "b");
    expect(stateOf(harness, controller)).not.toEqual(afterPoint);
    await ok(controller.dispatch({ type: "undo" }));
    expect(stateOf(harness, controller)).toEqual(afterPoint);
    await ok(controller.dispatch({ type: "undo" }));
    await rallies(controller, "b".repeat(FIRST_SET_WINNER_POINTS.b));
    await rallies(controller, "a".repeat(10));
    controller = await expectSurvivesKill(harness, controller);
    await rallies(controller, "a".repeat(FIRST_SET_WINNER_POINTS.a - 10));
    const decided = await controller.dispatch({ type: "score-point", team: "a" });
    expect(decided).toEqual({ ok: false, error: { code: "refused", reason: "set-decided" } });

    // Undo 3 takes back the end of the set; confirming it again closes it.
    await ok(controller.dispatch({ type: "confirm-set-end" }));
    expect(stateOf(harness, controller).currentMatch?.setsWon).toEqual({ a: 1, b: 0 });
    await ok(controller.dispatch({ type: "undo" }));
    expect(stateOf(harness, controller).currentMatch?.setsWon).toEqual({ a: 0, b: 0 });
    expect(stateOf(harness, controller).currentMatch?.currentSet?.score).toEqual({ a: 25, b: 22 });
    await ok(controller.dispatch({ type: "confirm-set-end" }));
    controller = await expectSurvivesKill(harness, controller);

    // Set 2: Azul wins 25-20; confirming it brings the toss of the decider (Azul serves first).
    await rallies(controller, "a".repeat(20));
    await rallies(controller, "b".repeat(5));
    controller = await expectSurvivesKill(harness, controller);
    await rallies(controller, "b".repeat(20));
    await ok(controller.dispatch({ type: "confirm-set-end", firstServer: "b" }));
    const decider = stateOf(harness, controller).currentMatch?.currentSet;
    expect(decider).toMatchObject({ firstServer: "b", servingTeam: "b", setNumber: 3 });
    expect(decider?.targetPoints).toBe(15);

    // Set 3: Laranja wins 15-13; the last confirmation stores SetEnded and MatchEnded together.
    await rallies(controller, "b".repeat(13));
    await rallies(controller, "a".repeat(5));
    controller = await expectSurvivesKill(harness, controller);
    await rallies(controller, "a".repeat(10));
    await ok(controller.dispatch({ type: "confirm-set-end" }));
    controller = await expectSurvivesKill(harness, controller);

    const finished = stateOf(harness, controller);
    expect(finished.currentMatch).toBeNull();
    expect(finished.finishedMatches).toHaveLength(1);
    expect(finished.finishedMatches[0]).toMatchObject({
      endReason: "sets-won",
      setsWon: { a: 2, b: 1 },
      winner: "a",
      completedSets: [
        { setNumber: 1, winner: "a", score: { a: 25, b: 22 } },
        { setNumber: 2, winner: "b", score: { a: 20, b: 25 } },
        { setNumber: 3, winner: "a", score: { a: 15, b: 13 } },
      ],
    });
  });

  test("the snapshot is what a new repository loads, after any run of commands", async () => {
    const harness = await createHarness(kind);
    await harness.start(SAMPLE_MATCH_BEST_OF_THREE);
    const controller = await reopen(harness);

    await rallies(controller, "abbaab");
    await controller.dispatch({ type: "undo" });
    await controller.dispatch({ type: "undo" });
    await controller.dispatch({ type: "confirm-set-end" });

    const snapshot = controller.getSnapshot();
    const loaded = await harness.log.load(COURT_SESSION_ID);
    expect(snapshot.status === "ready" && loaded.ok && snapshot.events).toEqual(
      loaded.ok && loaded.value.events,
    );
  });
});
