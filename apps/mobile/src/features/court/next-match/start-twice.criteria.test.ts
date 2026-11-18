import { defaultGroupSettings } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { createFakeCoinFlip } from "../../../adapters/fake-coin-flip";
import { createMemoryKeyValueStore } from "../../../adapters/memory-key-value-store";
import { createStoredNextMatchDrafts } from "../../../adapters/stored-next-match-drafts";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { ROSTER, confirmSet, score, startScenario } from "../model/screen-scenarios.test.fixture";
import { EMPTY_NEXT_MATCH_DRAFT } from "../ports/next-match-draft-store";
import { nextMatchModel } from "./next-match-model";
import { startNextMatch } from "./start-next-match";

describe("two taps on Confirmar that reach the log before a re-render", () => {
  test("only one MatchStarted is written; the second start is refused by the engine", async () => {
    const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
    await score(scenario, "a".repeat(25));
    await confirmSet(scenario);
    const settings = defaultGroupSettings();
    const model = nextMatchModel({
      state: stateOfTimeline(scenario.timeline()),
      settings,
      confirmed: [],
      draft: EMPTY_NEXT_MATCH_DRAFT,
      roster: ROSTER,
    });
    if (model.kind !== "planned") throw new Error(`no plan: ${model.kind}`);
    const drafts = createStoredNextMatchDrafts(createMemoryKeyValueStore());
    const start = () =>
      startNextMatch(
        {
          dispatch: (command) => scenario.controller.dispatch(command),
          drafts,
          ids: scenario.harness.ids,
          coinFlip: createFakeCoinFlip(["a", "b"]),
        },
        { plan: model.plan, finished: model.match, settings, positionOf: () => null },
      );
    const results = await Promise.all([start(), start()]);
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    const state = stateOfTimeline(scenario.timeline());
    expect(state.finishedMatches).toHaveLength(1);
    expect(state.currentMatch?.currentSet?.score).toEqual({ a: 0, b: 0 });
    const snapshot = scenario.controller.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("not ready");
    expect(snapshot.events.filter(({ type }) => type === "MatchStarted")).toHaveLength(2);
  });
});
