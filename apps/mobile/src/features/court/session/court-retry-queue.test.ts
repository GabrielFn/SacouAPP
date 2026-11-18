import { describe, expect, test } from "vitest";

import { createFakeCourtRuntime } from "../../../adapters/fake-court-runtime-opener";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import type { CourtEventLog } from "../ports/court-event-log";
import { createCourtSessionController } from "./court-session-controller";
import { startCourtMatch } from "./start-court-match";

const SESSION = "c0000000-0000-4000-8000-0000000000e2";

/** A log whose appends wait for `release`, to hold a command in the middle of its write. */
function gatedLog(log: CourtEventLog) {
  let release: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  const slow: CourtEventLog = {
    ...log,
    append: async (id, envelopes) => {
      await opened;
      return log.append(id, envelopes);
    },
  };
  return {
    slow,
    release: () => {
      release();
    },
  };
}

describe("retry goes through the queue of the controller", () => {
  test("a retry sent while a point is being written waits for it and loses nothing", async () => {
    const runtime = createFakeCourtRuntime();
    await startCourtMatch({ courtSessionId: SESSION, ...runtime }, SAMPLE_MATCH_ONE_SET);
    const { slow, release } = gatedLog(runtime.log);
    const controller = createCourtSessionController({
      courtSessionId: SESSION,
      ...runtime,
      log: slow,
    });
    await controller.whenIdle();

    const statuses: string[] = [];
    controller.subscribe(() => statuses.push(controller.getSnapshot().status));
    const point = controller.dispatch({ type: "score-point", team: "a" });
    const retry = controller.retry();
    let retried = false;
    void retry.then(() => {
      retried = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The write has not finished: the retry must not have read the log nor shown "loading".
    expect(retried).toBe(false);
    expect(statuses).toEqual([]);

    release();
    expect((await point).ok).toBe(true);
    await retry;
    expect(statuses).toEqual(["ready", "loading", "ready"]);
    const loaded = await runtime.log.load(SESSION);
    const snapshot = controller.getSnapshot();
    expect(loaded.ok).toBe(true);
    expect(snapshot.status === "ready" ? snapshot.events : null).toEqual(
      loaded.ok ? loaded.value.events : undefined,
    );
  });
});
