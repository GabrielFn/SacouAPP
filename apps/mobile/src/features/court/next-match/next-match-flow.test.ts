import { defaultGroupSettings } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { createFakeCoinFlip } from "../../../adapters/fake-coin-flip";
import { createFakeShuffler } from "../../../adapters/fake-shuffler";
import { createMemoryKeyValueStore } from "../../../adapters/memory-key-value-store";
import { createStoredNextMatchDrafts } from "../../../adapters/stored-next-match-drafts";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { nextCourtRoute } from "../model/court-route-step";
import {
  selectCourtPhase,
  selectCourtScreen,
  selectSetEnd,
  stateOfTimeline,
} from "../model/court-screen.selectors";
import { ROSTER, confirmSet, score, startScenario } from "../model/screen-scenarios.test.fixture";
import { firstServerToSend } from "../model/set-end-view";
import { nextMatchModel } from "./next-match-model";
import { startNextMatch } from "./start-next-match";

describe("from the decided set to the next match (D5 to D7)", () => {
  test("25 -> confirm -> 11 -> Confirmar -> the court at 0-0 with a new MatchStarted", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    const phase = () => selectCourtPhase(stateOfTimeline(scenario.timeline()));
    await score(scenario, "a".repeat(25));
    expect(nextCourtRoute("court", phase(), true)).toBe("open-set-end");
    const setEnd = selectSetEnd(scenario.timeline(), ROSTER);
    if (setEnd === null) throw new Error("no set to confirm");
    await confirmSet(scenario, firstServerToSend(setEnd, null));
    expect(nextCourtRoute("set-end", phase(), true)).toBe("open-match-end");

    const store = createMemoryKeyValueStore();
    const drafts = createStoredNextMatchDrafts(store);
    const shuffler = createFakeShuffler();
    const finished = stateOfTimeline(scenario.timeline()).finishedMatches.at(-1);
    if (finished === undefined) throw new Error("the match did not end");
    const draft = {
      drawOrder: {
        a: shuffler.shuffle(finished.teams.a.memberIds),
        b: shuffler.shuffle(finished.teams.b.memberIds),
      },
      chosen: { a: [], b: [] },
    };
    await drafts.save(finished.matchId, draft);
    const settings = defaultGroupSettings();
    const model = nextMatchModel({
      state: stateOfTimeline(scenario.timeline()),
      settings,
      confirmed: [],
      draft,
      roster: ROSTER,
    });
    if (model.kind !== "planned") throw new Error(`no plan: ${model.kind}`);

    const started = await startNextMatch(
      {
        dispatch: (command) => scenario.controller.dispatch(command),
        drafts,
        ids: scenario.harness.ids,
        coinFlip: createFakeCoinFlip(["b"]),
      },
      { plan: model.plan, finished: model.match, settings, positionOf: () => null },
    );

    expect(started.ok).toBe(true);
    expect(nextCourtRoute("match-end", phase(), true)).toBe("open-court");
    const match = stateOfTimeline(scenario.timeline()).currentMatch;
    expect(match?.matchId).not.toBe(finished.matchId);
    expect(match?.currentSet).toMatchObject({ score: { a: 0, b: 0 }, servingTeam: "b" });
    expect(store.entries().size).toBe(0);
    expect(shuffler.calls()).toBe(2);

    // The coin shows on the court at 0-0 and goes away with the first point (question 81).
    const hint = () => selectCourtScreen(scenario.timeline(), ROSTER)?.hint;
    expect(hint()).toEqual({ kind: "first-server-drawn", side: "b" });
    await score(scenario, "b");
    expect(hint()).toEqual({ kind: "positions" });
  });
});
