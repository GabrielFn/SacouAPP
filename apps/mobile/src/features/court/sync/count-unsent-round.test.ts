import { describe, expect, test } from "vitest";

import { createSyncHarness, ROUND } from "./court-sync.test.fixture";

const OTHER_ROUND = "r0000000-0000-4000-8000-0000000000ff";
const EVENTS_WRITTEN = 2;

describe("countUnsentOfRound (E4.12: the warning of screen 12)", () => {
  test("counts what this round still has to send, and nothing of the other rounds", async () => {
    const harness = await createSyncHarness({ online: false });
    await harness.write(EVENTS_WRITTEN);

    const sync = harness.sync();
    expect((await sync.countUnsentOfRound(ROUND.roundId)).events).toBe(EVENTS_WRITTEN);
    expect((await sync.countUnsent()).events).toBe(EVENTS_WRITTEN);
    expect(await sync.countUnsentOfRound(OTHER_ROUND)).toEqual({ events: 0, points: 0 });
  });
});
