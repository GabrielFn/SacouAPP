import { describe, expect, test } from "vitest";

import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { makeEnvelope, SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { COURT_SESSION_ID, createHarness, type CourtHarness } from "./court-harness.test.fixture";

const FAULT_PERIODS = [1, 2, 3, 5, 7] as const;
const POINTS_TO_TRY = 40;

async function fileIsConsistent(harness: CourtHarness): Promise<readonly number[]> {
  const loaded = await harness.log.load(COURT_SESSION_ID);
  if (!loaded.ok) {
    throw new Error(`load failed: ${loaded.error.code}`);
  }
  expect(harness.replayer.replay(COURT_SESSION_ID, loaded.value.events).ok).toBe(true);
  const sequences = loaded.value.events.map((event) => event.sequence);
  expect(sequences).toEqual(sequences.map((_, index) => index + 1));
  const positions = harness.sqlite?.raw
    .prepare("SELECT position FROM court_events ORDER BY position")
    .all()
    .map((row) => Number(row["position"]));
  expect(positions).toEqual(sequences.map((_, index) => index + 1));
  return sequences;
}

describe("a disk that fails every Nth write", () => {
  test.each(FAULT_PERIODS)(
    "period %i: the file always replays, has no gap, and the screen equals the file",
    async (period) => {
      const harness = await createHarness("sqlite");
      await harness.start(SAMPLE_MATCH_ONE_SET);
      let controller = harness.openController();
      await controller.whenIdle();

      for (let tap = 1; tap <= POINTS_TO_TRY; tap += 1) {
        if (tap % period === 0) {
          harness.sqlite?.failOnRun(1 + (tap % 3));
        }
        const result = await controller.dispatch({
          type: "score-point",
          team: tap % 2 ? "a" : "b",
        });
        harness.sqlite?.failOnRun(Number.MAX_SAFE_INTEGER);
        const sequences = await fileIsConsistent(harness);
        const snapshot = controller.getSnapshot();
        expect(snapshot.status === "ready" && snapshot.events.length).toBe(sequences.length);
        if (!result.ok && result.error.code === "write-failed") {
          controller = harness.openController();
          await controller.whenIdle();
        }
      }
      await fileIsConsistent(harness);
    },
  );
});

describe("a log that was damaged outside the app", () => {
  test("a stored sequence of 0 or a negative one is not accepted", async () => {
    const harness = await createHarness("sqlite");
    await harness.start(SAMPLE_MATCH_ONE_SET);
    harness.sqlite?.raw.exec("UPDATE court_events SET sequence = 0");

    const reopened = harness.openController();
    await reopened.whenIdle();

    expect(reopened.getSnapshot().status).toBe("failed");
  });

  test("an extra column added by a future schema does not break reading or writing", async () => {
    const harness = await createHarness("sqlite");
    harness.sqlite?.raw.exec("ALTER TABLE court_events ADD COLUMN sent_at TEXT");
    await harness.start(SAMPLE_MATCH_ONE_SET);
    const controller = harness.openController();
    await controller.whenIdle();

    const point = await controller.dispatch({ type: "score-point", team: "a" });

    expect(point.ok).toBe(true);
    const reopened = harness.openController();
    await reopened.whenIdle();
    const snapshot = reopened.getSnapshot();
    expect(snapshot.status === "ready" && snapshot.events).toHaveLength(2);
  });

  test("a missing column fails closed with a code, not a thrown error", async () => {
    const harness = await createHarness("sqlite");
    await harness.start(SAMPLE_MATCH_ONE_SET);
    harness.sqlite?.raw.exec("ALTER TABLE court_events DROP COLUMN payload");

    const controller = harness.openController();
    await controller.whenIdle();

    expect(controller.getSnapshot()).toEqual({ status: "failed", code: "storage-failed" });
  });
});

describe("the text stored in the file", () => {
  test("every payload is stored with sorted keys, whoever built the envelope", async () => {
    const harness = await createHarness("sqlite");
    await harness.start(SAMPLE_MATCH_ONE_SET);
    const controller = harness.openController();
    await controller.whenIdle();
    for (const team of ["a", "a", "b", "a"] as const) {
      await controller.dispatch({ type: "score-point", team });
    }
    await controller.dispatch({ type: "undo" });

    const rows = harness.sqlite?.raw.prepare("SELECT payload FROM court_events").all() ?? [];
    const sorted = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(sorted)
        : value !== null && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([left], [right]) => (left < right ? -1 : 1))
                .map(([key, inner]) => [key, sorted(inner)]),
            )
          : value;
    for (const row of rows) {
      const text = String(row["payload"]);
      expect(text).toBe(JSON.stringify(sorted(JSON.parse(text))));
    }
  });
});

test("fixture sanity: an envelope for another session is refused by the repository", async () => {
  const harness = await createHarness("sqlite");
  await harness.start(SAMPLE_MATCH_ONE_SET);
  const stray = await harness.log.append(COURT_SESSION_ID, [
    makeEnvelope({ courtSessionId: SESSION_A, sequence: 2 }),
  ]);
  expect(stray.ok).toBe(false);
});
