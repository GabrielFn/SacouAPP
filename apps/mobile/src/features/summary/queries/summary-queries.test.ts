import { describe, expect, test } from "vitest";

import { createFakeClock } from "../../../adapters/fake-clock";
import { createFakeScheduler } from "../../../adapters/fake-scheduler";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { GROUP } from "../../groups/model/members.test.fixture";
import { ROUND } from "../mvp-vote/model/mvp-ballot.test.fixture";
import { scheduleSummaryRefresh } from "./summary-queries";

const TARGET = { groupId: GROUP, roundId: ROUND };
const NOW = 1_000_000;
const WAIT_MS = 5_000;
const SUMMARY_KEY = queryKeys.roundSummary(GROUP, ROUND);
const BALLOT_KEY = queryKeys.mvpVoting(GROUP, ROUND);

function setup() {
  const scheduler = createFakeScheduler(createFakeClock());
  const client = createSacouQueryClient();
  client.setQueryData(SUMMARY_KEY, { finishedMatches: 1 });
  client.setQueryData(BALLOT_KEY, { state: "open" });
  return { scheduler, client };
}

describe("the summary read again when the voting changes by the clock (V7)", () => {
  test("at the moment, marks the summary and the ballot old and decides nothing", () => {
    const { scheduler, client } = setup();
    scheduleSummaryRefresh(scheduler, client, TARGET, NOW + WAIT_MS, NOW);
    expect(scheduler.pendingDelays()).toEqual([WAIT_MS]);
    scheduler.advance(WAIT_MS);
    expect(client.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryState(BALLOT_KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryData(SUMMARY_KEY)).toEqual({ finishedMatches: 1 });
  });

  test("closed voting waits for nothing; leaving the screen cancels the wait", () => {
    const { scheduler, client } = setup();
    scheduleSummaryRefresh(scheduler, client, TARGET, null, NOW);
    expect(scheduler.pendingDelays()).toEqual([]);
    const cancel = scheduleSummaryRefresh(scheduler, client, TARGET, NOW + WAIT_MS, NOW);
    cancel();
    expect(scheduler.pendingDelays()).toEqual([]);
  });
});
