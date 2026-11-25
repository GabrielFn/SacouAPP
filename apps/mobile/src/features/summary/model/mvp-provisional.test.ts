import { describe, expect, test } from "vitest";

import type { RoundSummaryReport } from "../../../services/api/sacou-api";
import { summaryStrings } from "../../../strings/summary.pt-BR";
import { E2_9_ROUND } from "./e2-9-round.test.fixture";
import { summaryShareText } from "./summary-share-text";
import { summaryView, type ReadySummary } from "./summary-view";

const OPENS = "2026-11-20T00:00:00Z";

/** Instants built in the local zone of the machine: the card speaks the clock of the phone. */
function local(day: number, hours: number, minutes: number): Date {
  return new Date(2026, 10, day, hours, minutes);
}

function ready(report: RoundSummaryReport, now: Date): ReadySummary {
  const view = summaryView({
    query: { status: "success", data: report, error: null },
    groupName: "Racha",
    members: [],
    online: true,
    unsentPoints: 0,
    ballot: undefined,
    nowMs: now.getTime(),
  });
  if (view.kind !== "ready") throw new Error(view.kind);
  return view;
}

function voting(state: "notOpen" | "open" | "closed", closesAt: Date) {
  return { state, opensAt: OPENS, closesAt: closesAt.toISOString() } as const;
}

const NIGHT = local(20, 23, 30);
const CLOSES = local(21, 12, 44);

describe("MVP provisional while the voting decides (R101 item 4)", () => {
  test("open, by the stats: 'Na frente pelo placar' and the deadline of tomorrow", () => {
    const mvp = ready({ ...E2_9_ROUND, mvpVoting: voting("open", CLOSES) }, NIGHT).mvp;
    expect(mvp?.title).toBe("Na frente pelo placar");
    expect(mvp?.accessibility).toMatch(/^Na frente pelo placar: /u);
    expect(mvp?.notes).toEqual(["A galera decide até amanhã, 12h44"]);
  });

  test("the deadline is 'hoje' when the voting closes on the same day (after midnight)", () => {
    const mvp = ready({ ...E2_9_ROUND, mvpVoting: voting("open", CLOSES) }, local(21, 0, 10)).mvp;
    expect(mvp?.notes).toEqual(["A galera decide até hoje, 12h44"]);
  });

  test("not open yet, by the stats: provisional title, the note stays 'Calculado pelo placar'", () => {
    const mvp = ready({ ...E2_9_ROUND, mvpVoting: voting("notOpen", CLOSES) }, NIGHT).mvp;
    expect(mvp?.title).toBe("Na frente pelo placar");
    expect(mvp?.notes).toEqual([summaryStrings.mvpNote]);
    expect(mvp?.votingDeadline).toBeNull();
  });

  test("closed with votes: 'MVP do dia', 'Escolhido pela galera'", () => {
    const mvp = ready(
      {
        ...E2_9_ROUND,
        mvp: { ...E2_9_ROUND.mvp, source: "votes" } as RoundSummaryReport["mvp"],
        mvpVoting: voting("closed", CLOSES),
      },
      NIGHT,
    ).mvp;
    expect(mvp).toMatchObject({ title: "MVP do dia", provisional: false });
    expect(mvp?.notes).toEqual([summaryStrings.mvpByVotesNote]);
  });

  test("closed with no valid vote, or the voting off: 'MVP do dia', 'Calculado pelo placar'", () => {
    for (const mvpVoting of [voting("closed", CLOSES), null]) {
      const mvp = ready({ ...E2_9_ROUND, mvpVoting }, NIGHT).mvp;
      expect(mvp).toMatchObject({ title: "MVP do dia", provisional: false });
      expect(mvp?.notes).toEqual([summaryStrings.mvpNote]);
    }
  });

  test("the text for the group: leading, with the deadline when open, without it when not open yet", () => {
    const open = summaryShareText(
      ready({ ...E2_9_ROUND, mvpVoting: voting("open", CLOSES) }, NIGHT),
    );
    expect(open).toContain("Na frente pelo placar: ");
    expect(open).toContain(" A galera decide o MVP até amanhã, 12h44.");
    const notOpen = summaryShareText(
      ready({ ...E2_9_ROUND, mvpVoting: voting("notOpen", CLOSES) }, NIGHT),
    );
    expect(notOpen).toContain("Na frente pelo placar: ");
    expect(notOpen).not.toContain("A galera decide");
    const closed = summaryShareText(
      ready({ ...E2_9_ROUND, mvpVoting: voting("closed", CLOSES) }, NIGHT),
    );
    expect(closed).toContain("MVP do dia: ");
  });
});
