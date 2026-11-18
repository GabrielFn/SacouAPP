import { defaultGroupSettings, type FinishedMatch } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { createFakeShuffler } from "../../../adapters/fake-shuffler";
import { createMemoryKeyValueStore } from "../../../adapters/memory-key-value-store";
import { createStoredNextMatchDrafts } from "../../../adapters/stored-next-match-drafts";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { confirmSet, score, startScenario } from "../model/screen-scenarios.test.fixture";
import type { CourtRound, CourtRoundSource } from "../ports/court-round-source";
import { loadOrCreateDraft, roundOf } from "./use-match-end";

const ORIGIN = { groupId: "group-1", roundId: "round-1" };
const POSITION_OF = () => null;

function sourceOf(round: CourtRound): CourtRoundSource {
  return { read: () => round };
}

async function finishedMatch(): Promise<FinishedMatch> {
  const scenario = await startScenario(SAMPLE_MATCH_ONE_SET);
  await score(scenario, "a".repeat(25));
  await confirmSet(scenario, undefined);
  const finished = stateOfTimeline(scenario.timeline()).finishedMatches.at(-1);
  if (finished === undefined) throw new Error("the match did not end");
  return finished;
}

describe("the round of the session on screen 11", () => {
  test("a session without origin plays by the defaults", () => {
    const round = roundOf(
      sourceOf({ settings: null, confirmed: [], positionOf: POSITION_OF }),
      null,
    );
    expect(round?.settings).toEqual(defaultGroupSettings());
  });

  test("a session with origin and no round on the phone has no plan, not the defaults", () => {
    const round = roundOf(
      sourceOf({ settings: null, confirmed: [], positionOf: POSITION_OF }),
      ORIGIN,
    );
    expect(round).toBeNull();
  });

  test("a session with origin and its round uses the settings of the round", () => {
    const settings = defaultGroupSettings();
    const round = roundOf(sourceOf({ settings, confirmed: [], positionOf: POSITION_OF }), ORIGIN);
    expect(round?.settings).toBe(settings);
  });
});

describe("the draft of the finished match", () => {
  test("a stored draft is returned as it is, with no new shuffle", async () => {
    const finished = await finishedMatch();
    const drafts = createStoredNextMatchDrafts(createMemoryKeyValueStore());
    const stored = {
      drawOrder: { a: finished.teams.a.memberIds, b: finished.teams.b.memberIds },
      chosen: { a: [], b: [] },
    };
    await drafts.save(finished.matchId, stored);
    const shuffler = createFakeShuffler();

    const draft = await loadOrCreateDraft(drafts, shuffler, finished);

    expect(draft).toEqual(stored);
    expect(shuffler.calls()).toBe(0);
  });

  test("with no draft it shuffles once and saves it before returning", async () => {
    const finished = await finishedMatch();
    const drafts = createStoredNextMatchDrafts(createMemoryKeyValueStore());
    const shuffler = createFakeShuffler();

    const draft = await loadOrCreateDraft(drafts, shuffler, finished);

    expect(shuffler.calls()).toBe(2);
    expect(await drafts.load(finished.matchId)).toEqual(draft);
    const again = await loadOrCreateDraft(drafts, shuffler, finished);
    expect(again).toEqual(draft);
    expect(shuffler.calls()).toBe(2);
  });
});
