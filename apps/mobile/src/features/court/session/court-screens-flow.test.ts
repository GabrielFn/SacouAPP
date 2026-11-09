import { describe, expect, test } from "vitest";

import { createFakeCourtRuntime } from "../../../adapters/fake-court-runtime-opener";
import { startSampleMatch } from "../dev/start-sample-match";
import { SAMPLE_MATCH_ONE_SET } from "../dev/sample-match.data";
import { isDevToolsFlagOn } from "../../../config/dev-tools";
import { createCourtSessionController } from "./court-session-controller";
import { findResumableCourtSession } from "./resume-court";
import { startCourtMatch } from "./start-court-match";

const SESSION = "c0000000-0000-4000-8000-0000000000e1";

describe("retry after a failed opening", () => {
  test("a session that did not exist is failed; once it exists, retry reads the log", async () => {
    const runtime = createFakeCourtRuntime();
    const controller = createCourtSessionController({ courtSessionId: SESSION, ...runtime });
    await controller.whenIdle();
    expect(controller.getSnapshot()).toEqual({ status: "failed", code: "session-not-found" });

    await runtime.log.openSession(SESSION);
    await controller.retry();
    expect(controller.getSnapshot()).toEqual({
      status: "ready",
      courtSessionId: SESSION,
      events: [],
    });
  });

  test("a log that is still broken stays failed, and the commands answer not-ready", async () => {
    const runtime = createFakeCourtRuntime();
    const controller = createCourtSessionController({ courtSessionId: SESSION, ...runtime });
    await controller.retry();
    expect(controller.getSnapshot().status).toBe("failed");
    expect(await controller.dispatch({ type: "undo" })).toEqual({
      ok: false,
      error: { code: "not-ready" },
    });
  });

  test("retry shows loading while it reads and the next command works after it", async () => {
    const runtime = createFakeCourtRuntime();
    await startCourtMatch({ courtSessionId: SESSION, ...runtime }, SAMPLE_MATCH_ONE_SET);
    const controller = createCourtSessionController({ courtSessionId: SESSION, ...runtime });
    await controller.whenIdle();
    const seen: string[] = [];
    controller.subscribe(() => seen.push(controller.getSnapshot().status));
    await controller.retry();
    expect(seen).toEqual(["loading", "ready"]);
    expect(await controller.dispatch({ type: "score-point", team: "a" })).toEqual({
      ok: true,
      value: undefined,
    });
  });
});

describe("resuming after the app was closed", () => {
  test("nothing open, nothing to resume", async () => {
    expect(await findResumableCourtSession(createFakeCourtRuntime())).toBeNull();
  });

  test("an open court with a match in progress is resumed", async () => {
    const runtime = createFakeCourtRuntime();
    const started = await startSampleMatch(runtime, "one-set");
    expect(started.ok && (await findResumableCourtSession(runtime))).toBe(
      started.ok ? started.value.courtSessionId : null,
    );
  });

  test("a closed court is not resumed", async () => {
    const runtime = createFakeCourtRuntime();
    const started = await startSampleMatch(runtime, "one-set");
    if (!started.ok) throw new Error("did not start");
    await runtime.log.closeSession(started.value.courtSessionId);
    expect(await findResumableCourtSession(runtime)).toBeNull();
  });

  test("a session opened with no match started is not resumed", async () => {
    const runtime = createFakeCourtRuntime();
    await runtime.log.openSession(SESSION);
    expect(await findResumableCourtSession(runtime)).toBeNull();
  });

  test("a match that ended is not resumed: the court has nothing to play", async () => {
    const runtime = createFakeCourtRuntime();
    const started = await startSampleMatch(runtime, "one-set");
    if (!started.ok) throw new Error("did not start");
    const controller = createCourtSessionController({
      courtSessionId: started.value.courtSessionId,
      ...runtime,
    });
    await controller.whenIdle();
    for (const team of "a".repeat(25)) {
      await controller.dispatch({ type: "score-point", team: team === "a" ? "a" : "b" });
    }
    await controller.dispatch({ type: "confirm-set-end" });
    expect(await findResumableCourtSession(runtime)).toBeNull();
  });
});

describe("the sample match of the development screen", () => {
  test("starts in a new court session and closes the one that was open", async () => {
    const runtime = createFakeCourtRuntime();
    const first = await startSampleMatch(runtime, "one-set");
    const second = await startSampleMatch(runtime, "best-of-three");
    if (!first.ok || !second.ok) throw new Error("did not start");
    expect(second.value.courtSessionId).not.toBe(first.value.courtSessionId);
    expect(await runtime.log.findActiveSession()).toEqual({
      ok: true,
      value: second.value.courtSessionId,
    });
  });
});

describe("the flag of the development tools", () => {
  test.each([
    ["1", true],
    ["0", false],
    ["", false],
    ["true", false],
    [undefined, false],
    [1, false],
  ])("%s", (flag, expected) => {
    expect(isDevToolsFlagOn(flag)).toBe(expected);
  });
});
