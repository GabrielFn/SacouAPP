import { describe, expect, test, vi } from "vitest";

import { err } from "@sacou/volley-rules";

import type { CourtEventLog } from "../ports/court-event-log";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import {
  COURT_SESSION_ID,
  createHarness,
  rallies,
  stateOf,
  type CourtHarness,
  type StorageKind,
} from "./court-harness.test.fixture";
import { createCourtSessionController } from "./court-session-controller";

const STORAGES: readonly StorageKind[] = ["memory", "sqlite"];
const FIXED_EVENT_ID = "e0000000-0000-4000-8000-0000000000ee";

async function startedHarness(kind: StorageKind) {
  const harness = await createHarness(kind);
  await harness.start(SAMPLE_MATCH_ONE_SET);
  const controller = harness.openController();
  await controller.whenIdle();
  return { harness, controller };
}

async function storedSequences(harness: CourtHarness): Promise<readonly number[]> {
  const loaded = await harness.log.load(COURT_SESSION_ID);
  return loaded.ok ? loaded.value.events.map((event) => event.sequence) : [];
}

describe("loading", () => {
  test("starts loading, notifies when ready and shows the persisted events", async () => {
    const harness = await createHarness("memory");
    await harness.start(SAMPLE_MATCH_ONE_SET);
    const controller = harness.openController();
    const listener = vi.fn();
    controller.subscribe(listener);

    expect(controller.getSnapshot()).toEqual({ status: "loading" });
    await controller.whenIdle();

    expect(listener).toHaveBeenCalledTimes(1);
    const snapshot = controller.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.events.map((event) => event.type)).toEqual([
      "MatchStarted",
    ]);
  });

  test("a log that does not replay fails closed and keeps the file", async () => {
    const { harness } = await startedHarness("sqlite");
    harness.sqlite?.raw.exec("UPDATE court_events SET type = 'Unknown'");

    const controller = harness.openController();
    await controller.whenIdle();

    expect(controller.getSnapshot()).toEqual({ status: "failed", code: "replay-failed" });
    expect(await controller.dispatch({ type: "undo" })).toEqual({
      ok: false,
      error: { code: "not-ready" },
    });
    expect(harness.sqlite?.raw.prepare("SELECT COUNT(*) AS n FROM court_events").get()).toEqual({
      n: 1,
    });
  });

  test("a payload with an extra field fails closed and never echoes it", async () => {
    const { harness } = await startedHarness("sqlite");
    harness.sqlite?.raw.exec(
      `UPDATE court_events SET payload = '{"name":"Pedro-Silva-secret"}' WHERE position = 1`,
    );

    const controller = harness.openController();
    await controller.whenIdle();

    const snapshot = controller.getSnapshot();
    expect(snapshot).toEqual({ status: "failed", code: "replay-failed" });
    expect(JSON.stringify(snapshot)).not.toContain("Pedro-Silva-secret");
  });

  test("a corrupted row fails closed with a code and no value", async () => {
    const { harness } = await startedHarness("sqlite");
    harness.sqlite?.raw.exec("UPDATE court_events SET payload = 'Pedro'");

    const controller = harness.openController();
    await controller.whenIdle();

    expect(controller.getSnapshot()).toEqual({ status: "failed", code: "corrupted-log" });
  });
});

describe.each(STORAGES)("commands (%s)", (kind) => {
  test("a refusal of the engine writes nothing and keeps the snapshot", async () => {
    const { harness, controller } = await startedHarness(kind);
    await rallies(controller, "b".repeat(23) + "a".repeat(25));
    const before = controller.getSnapshot();

    const point = await controller.dispatch({ type: "score-point", team: "a" });

    expect(point).toEqual({ ok: false, error: { code: "refused", reason: "set-decided" } });
    expect(controller.getSnapshot()).toBe(before);
    expect(await storedSequences(harness)).toHaveLength(49);
  });

  test("undo at the start of the match is refused", async () => {
    const { controller } = await startedHarness(kind);
    const before = controller.getSnapshot();

    const undo = await controller.dispatch({ type: "undo" });

    expect(undo).toEqual({ ok: false, error: { code: "refused", reason: "nothing-to-undo" } });
    expect(controller.getSnapshot()).toBe(before);
  });

  test("a failed write changes nothing and the next command works", async () => {
    const { harness, controller } = await startedHarness(kind);
    const before = controller.getSnapshot();
    harness.failNextWrite();

    const failed = await controller.dispatch({ type: "score-point", team: "a" });

    expect(failed).toEqual({ ok: false, error: { code: "write-failed", cause: "storage-failed" } });
    expect(controller.getSnapshot()).toEqual(before);
    expect(await storedSequences(harness)).toEqual([1]);
    expect((await controller.dispatch({ type: "score-point", team: "a" })).ok).toBe(true);
    expect(await storedSequences(harness)).toEqual([1, 2]);
  });

  test("commands sent without waiting are stored in order and each sees the one before", async () => {
    const { harness, controller } = await startedHarness(kind);

    const results = await Promise.all([
      controller.dispatch({ type: "score-point", team: "a" }),
      controller.dispatch({ type: "score-point", team: "a" }),
      controller.dispatch({ type: "undo" }),
    ]);

    expect(results.map((result) => result.ok)).toEqual([true, true, true]);
    expect(await storedSequences(harness)).toEqual([1, 2, 3, 4]);
    expect(stateOf(harness, controller).currentMatch?.currentSet?.score).toEqual({ a: 1, b: 0 });
  });

  test("a log the replay would refuse is not written", async () => {
    const { harness, controller } = await startedHarness(kind);
    await rallies(controller, "b".repeat(23) + "a".repeat(25));
    const constantIds = { newId: () => FIXED_EVENT_ID };
    const reckless = harness.openController({ ids: constantIds });
    await reckless.whenIdle();
    const stored = await storedSequences(harness);

    // SetEnded and MatchEnded would carry the same event id: the simulation refuses them.
    const outcome = await reckless.dispatch({ type: "confirm-set-end" });

    expect(outcome).toEqual({ ok: false, error: { code: "rejected" } });
    expect(await storedSequences(harness)).toEqual(stored);
  });

  test("an event id the parser refuses is rejected before anything is written", async () => {
    const { harness, controller } = await startedHarness(kind);
    const stored = await storedSequences(harness);
    const broken = harness.openController({ ids: { newId: () => "not-a-uuid" } });
    await broken.whenIdle();

    const outcome = await broken.dispatch({ type: "score-point", team: "a" });

    expect(outcome).toEqual({ ok: false, error: { code: "rejected" } });
    expect(await storedSequences(harness)).toEqual(stored);
    expect(controller.getSnapshot().status).toBe("ready");
  });

  test("the replay of the same log runs once: the screen reads what the tap simulated", async () => {
    const { harness, controller } = await startedHarness(kind);
    const runsBefore = harness.runs();

    await controller.dispatch({ type: "score-point", team: "a" });
    const snapshot = controller.getSnapshot();
    if (snapshot.status === "ready") {
      harness.replayer.replay(COURT_SESSION_ID, snapshot.events);
      harness.replayer.replay(COURT_SESSION_ID, snapshot.events);
    }

    expect(harness.runs()).toBe(runsBefore + 1);
  });
});

describe("a write that fails after the commit", () => {
  test("the snapshot is the file again, and the next command works", async () => {
    const harness = await createHarness("sqlite");
    await harness.start(SAMPLE_MATCH_ONE_SET);
    const real = harness.log;
    const failures = { left: 1 };
    const failingAfterCommit: CourtEventLog = {
      ...real,
      append: async (id, envelopes) => {
        const written = await real.append(id, envelopes);
        if (failures.left === 0) return written;
        failures.left -= 1;
        return err({ code: "storage-failed" });
      },
    };
    const controller = createCourtSessionController({
      courtSessionId: COURT_SESSION_ID,
      log: failingAfterCommit,
      replayer: harness.replayer,
      ids: harness.ids,
    });
    await controller.whenIdle();

    const failed = await controller.dispatch({ type: "score-point", team: "a" });

    expect(failed).toEqual({ ok: false, error: { code: "write-failed", cause: "storage-failed" } });
    const stored = await real.load(COURT_SESSION_ID);
    const snapshot = controller.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.events).toEqual(
      stored.ok && stored.value.events,
    );
    expect(await storedSequences(harness)).toEqual([1, 2]);
    expect((await controller.dispatch({ type: "undo" })).ok).toBe(true);
    expect(await storedSequences(harness)).toEqual([1, 2, 3]);
  });
});

describe("the end of the deciding set", () => {
  test("SetEnded and MatchEnded are stored together or not at all", async () => {
    const { harness, controller } = await startedHarness("sqlite");
    await rallies(controller, "b".repeat(23) + "a".repeat(25));
    const stored = await storedSequences(harness);
    harness.sqlite?.failOnRun(2);

    const failed = await controller.dispatch({ type: "confirm-set-end" });

    expect(failed).toEqual({ ok: false, error: { code: "write-failed", cause: "storage-failed" } });
    expect(await storedSequences(harness)).toEqual(stored);
    expect((await controller.dispatch({ type: "confirm-set-end" })).ok).toBe(true);
    expect(await storedSequences(harness)).toHaveLength(stored.length + 2);
  });
});
