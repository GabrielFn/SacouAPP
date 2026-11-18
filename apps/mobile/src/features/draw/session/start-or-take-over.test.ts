import { err, ok } from "@sacou/volley-rules";
import { describe, expect, test, vi } from "vitest";

import type { CourtSummaryLookup } from "../../court/takeover/court-summary-lookup";
import { startOrTakeOver } from "./start-from-draw";

const STREAM = "c0000000-0000-4000-8000-00000000000a";
const FOUND: CourtSummaryLookup = {
  status: "found",
  summary: {
    courtSessionId: STREAM,
    currentBatch: 1,
    eventCount: 3,
    writer: { memberId: "m", since: "2026-11-18T21:14:00Z" },
    lastEventAt: null,
    scoreboard: null,
  },
};

describe("Começar partida with the court of the round on another phone (E4.11, D5)", () => {
  test("a stream this phone does not write: the 09a, and nothing is started", async () => {
    const start = vi.fn(() => Promise.resolve(ok(STREAM)));
    const opened = await startOrTakeOver({
      lookUp: () => Promise.resolve(FOUND),
      local: null,
      start,
    });
    expect(opened).toEqual({ ok: true, value: { kind: "take-over" } });
    expect(start).not.toHaveBeenCalled();
  });

  test("offline or no stream: the match starts as before", async () => {
    const start = () => Promise.resolve(ok(STREAM));
    const offline = { lookUp: () => Promise.resolve(undefined), local: null, start };
    expect(await startOrTakeOver(offline)).toEqual({
      ok: true,
      value: { kind: "court", courtSessionId: STREAM },
    });
    const none = { ...offline, lookUp: () => Promise.resolve({ status: "none" } as const) };
    expect((await startOrTakeOver(none)).ok).toBe(true);
    const failing = { ...offline, start: () => Promise.resolve(err("match-open" as const)) };
    expect(await startOrTakeOver(failing)).toEqual({ ok: false, error: "match-open" });
  });
});
