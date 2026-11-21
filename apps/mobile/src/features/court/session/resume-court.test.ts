import { describe, expect, test } from "vitest";

import type { RoundEnd, RoundEndLookup } from "../ports/round-end-lookup";
import { OLD_ROUND, OLD_SESSION, openWithMatch, testCourt } from "./open-court.test.fixture";
import { findResumableCourtSession } from "./resume-court";
import { createResumeOnce } from "./resume-once";
import { RESUME_GRACE_MS } from "./round-end";

const ENDS_AT = Date.parse("2026-11-19T23:00:00Z");

function lookup(end: RoundEnd): RoundEndLookup {
  return { endOf: () => end };
}

const LISTED: RoundEnd = {
  kind: "listed",
  endsAt: ENDS_AT,
  localDate: "2026-11-19",
  canceled: false,
};

async function resumableAt(end: RoundEnd, now: number): Promise<string | null> {
  const court = testCourt();
  await openWithMatch(court, OLD_ROUND);
  return findResumableCourtSession({ ...court, rounds: lookup(end), now });
}

describe("findResumableCourtSession: opens on its own only until the round ends (R97, D4)", () => {
  test("a round that has not ended resumes", async () => {
    expect(await resumableAt(LISTED, ENDS_AT - 1)).toBe(OLD_SESSION);
  });

  test("the grace after the end still resumes, to its last millisecond", async () => {
    expect(await resumableAt(LISTED, ENDS_AT + RESUME_GRACE_MS - 1)).toBe(OLD_SESSION);
  });

  test("from the end plus the grace on, it does not resume", async () => {
    expect(await resumableAt(LISTED, ENDS_AT + RESUME_GRACE_MS)).toBeNull();
  });

  test("a canceled round does not resume", async () => {
    expect(await resumableAt({ ...LISTED, canceled: true }, ENDS_AT - 1)).toBeNull();
  });

  test("a round missing from a list the cache can trust does not resume", async () => {
    expect(await resumableAt({ kind: "gone" }, ENDS_AT)).toBeNull();
  });

  test("with no cache (offline on the first use) it resumes as before", async () => {
    expect(await resumableAt({ kind: "unknown" }, ENDS_AT + RESUME_GRACE_MS)).toBe(OLD_SESSION);
  });

  test("a sample session has no round and resumes", async () => {
    const court = testCourt();
    await openWithMatch(court, null);
    const rounds = lookup({ kind: "gone" });

    expect(await findResumableCourtSession({ ...court, rounds, now: ENDS_AT })).toBe(OLD_SESSION);
  });

  test("the owner's case: Sair, then the app opens again after the round, no resume", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    const rounds = lookup(LISTED);
    const during = createResumeOnce(
      await findResumableCourtSession({ ...court, rounds, now: ENDS_AT - 1 }),
    );
    expect(during.take()).toBe(OLD_SESSION);
    // "Sair do modo quadra" closes nothing: the next day the app opens again.
    const nextDay = ENDS_AT + RESUME_GRACE_MS + 1;
    const reopened = createResumeOnce(
      await findResumableCourtSession({ ...court, rounds, now: nextDay }),
    );

    expect(reopened.take()).toBeNull();
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: OLD_SESSION });
  });
});
