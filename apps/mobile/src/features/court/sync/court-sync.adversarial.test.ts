import { describe, expect, test, vi } from "vitest";

import { parseRetryAfter } from "../../../services/api/api-policy";
import { accountRef, ackedOf, createSyncHarness, settled } from "./court-sync.test.fixture";
import { errorFault, loseAnswer } from "./fake-court-stream-server.test.fixture";
import { MAX_BACKOFF_MS } from "./sync.data";

describe("the court upload under attack (E4.11, tester)", () => {
  test("airplane mode in the middle of a batch: nothing lost, nothing twice", async () => {
    const harness = await createSyncHarness({ online: false });
    const written = await harness.write(450);
    harness.server.failNext(loseAnswer);
    harness.network.set(true);
    await settled(harness.sync());
    harness.network.set(false);
    harness.scheduler.advance(MAX_BACKOFF_MS);
    await settled(harness.sync());
    harness.network.set(true);
    harness.scheduler.advance(MAX_BACKOFF_MS);
    await settled(harness.sync());

    expect(harness.server.stored()).toEqual(written);
    expect(new Set(harness.server.stored().map((event) => event.eventId)).size).toBe(450);
    expect(await ackedOf(harness.log)).toBe(450);
  });

  test("Retry-After of 0 retries at once, and of 60 s waits the whole minute", async () => {
    const harness = await createSyncHarness();
    harness.server.failNext(
      errorFault({ kind: "rate-limited", retryAfterMs: 0 }),
      errorFault({ kind: "rate-limited", retryAfterMs: 60_000 }),
    );
    const written = await harness.write(2);
    await settled(harness.sync());
    expect(harness.scheduler.pendingDelays()).toEqual([0]);
    harness.scheduler.advance(0);
    await settled(harness.sync());
    expect(harness.server.requests()).toHaveLength(2);
    expect(harness.scheduler.pendingDelays()).toEqual([60_000]);
    harness.scheduler.advance(59_999);
    await settled(harness.sync());
    expect(harness.server.requests()).toHaveLength(2);
    harness.scheduler.advance(1);
    await settled(harness.sync());
    expect(harness.server.stored()).toEqual(written);
  });

  test("Retry-After parsing: 0, 60 and absurd values stay between 0 and 60 s", () => {
    expect(parseRetryAfter("0", 0)).toBe(0);
    expect(parseRetryAfter("60", 0)).toBe(60_000);
    expect(parseRetryAfter("99999999999", 0)).toBe(60_000);
    expect(parseRetryAfter("-5", 0)).toBeLessThanOrEqual(60_000);
    expect(parseRetryAfter("1e9", 0)).toBeLessThanOrEqual(60_000);
  });

  test("a streak of 5xx: the wait grows and stops at the ceiling", async () => {
    const harness = await createSyncHarness();
    const down = errorFault({ kind: "unexpected", status: 503 });
    harness.server.failNext(...Array.from({ length: 12 }, () => down));
    await harness.write(1);
    const waits: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      await settled(harness.sync());
      const [delay] = harness.scheduler.pendingDelays();
      waits.push(delay ?? -1);
      harness.scheduler.advance(delay ?? 0);
    }
    await settled(harness.sync());
    const failedWaits = waits.filter((wait) => wait >= 0);
    expect(failedWaits.slice(0, 4)).toEqual([4_000, 8_000, 16_000, 32_000]);
    expect(failedWaits.slice(4).every((wait) => wait === MAX_BACKOFF_MS)).toBe(true);
    expect(Math.max(...failedWaits)).toBe(MAX_BACKOFF_MS);
    expect(harness.server.stored()).toHaveLength(1);
  });

  test("account switched while a batch is out: that batch carries the owner token, none follows for B", async () => {
    const harness = await createSyncHarness();
    const release = harness.server.holdNext();
    await harness.write(2);
    await vi.waitFor(() => {
      expect(harness.server.requests()).toHaveLength(1);
    });
    harness.account.switchTo(accountRef("b"));
    await harness.write(2);
    release();
    await settled(harness.sync());

    const requests = harness.server.requests();
    expect(requests.every((request) => request.account === harness.owner.session)).toBe(true);
    expect(requests).toHaveLength(1);
    harness.account.switchTo(harness.owner);
    await settled(harness.sync());
    expect(harness.server.stored()).toHaveLength(4);
  });

  test("hostile details of a 409 never break the loop: the session stops, no burst", async () => {
    const hostile = [
      { expectedSequence: Number.MAX_SAFE_INTEGER },
      { expectedSequence: -3 },
      { expectedSequence: 0 },
      { expectedSequence: 1_000_000 },
    ];
    for (const details of hostile) {
      const harness = await createSyncHarness();
      harness.server.failNext(
        errorFault({ kind: "problem", status: 409, code: "matches.sequence-gap", details }),
      );
      await harness.write(3);
      await settled(harness.sync());
      expect(harness.server.requests().length).toBeLessThanOrEqual(2);
      expect(harness.scheduler.pendingDelays().length).toBeLessThanOrEqual(1);
    }
  });
});
