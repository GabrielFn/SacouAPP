import { describe, expect, test, vi } from "vitest";

import { createSyncHarness, ROUND, settled } from "./court-sync.test.fixture";

const EVENTS_WRITTEN = 2;

describe("onAcknowledged (E4.12: the summary is read again when the server confirms points)", () => {
  test("is told, with the group and the round, when the server confirms events", async () => {
    const onAcknowledged = vi.fn();
    const harness = await createSyncHarness({ onAcknowledged });
    await harness.write(EVENTS_WRITTEN);
    await settled(harness.sync());

    await vi.waitFor(() => {
      expect(onAcknowledged).toHaveBeenCalled();
    });
    expect(onAcknowledged).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: ROUND.groupId, roundId: ROUND.roundId }),
    );
  });

  test("stays quiet while offline, since nothing was confirmed", async () => {
    const onAcknowledged = vi.fn();
    const harness = await createSyncHarness({ online: false, onAcknowledged });
    await harness.write(EVENTS_WRITTEN);
    await settled(harness.sync());

    expect(onAcknowledged).not.toHaveBeenCalled();
  });
});
