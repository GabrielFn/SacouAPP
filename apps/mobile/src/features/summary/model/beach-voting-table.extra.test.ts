import { describe, expect, test } from "vitest";

import type { Member, MvpBallot, RoundSummaryReport } from "../../../services/api/sacou-api";
import { summaryStrings } from "../../../strings/summary.pt-BR";
import { BIA, E2_9_ROUND } from "./e2-9-round.test.fixture";
import { SHARE_RANKING_LINES, summaryShareText } from "./summary-share-text";
import { summaryView, type ReadySummary } from "./summary-view";

const GABI = "a0000000-0000-4000-8000-000000000002";
const OPENS = "2026-11-20T00:00:00Z";
const CLOSES = "2026-11-21T00:00:00Z";
const NOW = Date.parse(OPENS);
const MEMBERS: readonly Member[] = [
  [BIA, "Bia"],
  [GABI, "Gabi"],
].map(([memberId, nickname]) => ({
  memberId: memberId as string,
  role: "player",
  memberType: "regular",
  hasAccount: true,
  isMe: false,
  joinedAt: "2026-11-01T00:00:00Z",
  nickname: nickname as string,
  primaryPosition: null,
  otherPositions: [],
}));

type Mvp = NonNullable<RoundSummaryReport["mvp"]>;
const NOT_OPEN = { state: "notOpen", opensAt: CLOSES, closesAt: CLOSES } as const;
const OPEN = { state: "open", opensAt: OPENS, closesAt: CLOSES } as const;
const CLOSED = { state: "closed", opensAt: OPENS, closesAt: CLOSES } as const;
const BALLOT: MvpBallot = {
  state: "open",
  opensAt: OPENS,
  closesAt: CLOSES,
  canVote: true,
  reason: null,
  myVote: null,
  candidates: [],
};
const VOTED: MvpBallot = {
  ...BALLOT,
  canVote: false,
  reason: "alreadyVoted",
  myVote: { candidateMemberId: GABI, castAt: OPENS },
};
const VOTES_MVP: Mvp = { ...(E2_9_ROUND.mvp as Mvp), source: "votes" };

function ready(report: RoundSummaryReport, ballot?: MvpBallot): ReadySummary {
  const view = summaryView({
    query: { status: "success", data: report, error: null },
    groupName: "Racha",
    members: MEMBERS,
    online: true,
    unsentPoints: 0,
    ballot,
    nowMs: NOW,
  });
  if (view.kind !== "ready") throw new Error(view.kind);
  return view;
}

describe("table 3.2, each state of the voting against the source of the MVP", () => {
  test("voting off: stats card, no entry, no extra note", () => {
    const view = ready(E2_9_ROUND);
    expect(view.voting).toEqual({ kind: "hidden" });
    expect(view.mvp?.notes).toEqual([summaryStrings.mvpNote]);
  });

  test("not open, with stats or with no MVP: only the line, no button", () => {
    for (const mvp of [E2_9_ROUND.mvp, null]) {
      const view = ready({ ...E2_9_ROUND, mvp, mvpVoting: NOT_OPEN });
      expect(view.voting.kind).toBe("not-open");
      expect(view.mvp === null).toBe(mvp === null);
    }
  });

  test("open with stats: the card carries the open note; the entry follows the ballot", () => {
    const report = { ...E2_9_ROUND, mvpVoting: OPEN };
    expect(ready(report, BALLOT).mvp?.notes[0]).toMatch(/^A galera decide até /u);
    expect(ready(report, BALLOT).voting).toEqual({
      kind: "vote",
      label: "Votar no MVP · fecha em 24 h",
    });
    expect(ready(report, VOTED).voting).toEqual({
      kind: "voted",
      text: "Você já votou · resultado em 24 h",
    });
    expect(ready(report, { ...BALLOT, canVote: false, reason: "notPlayed" }).voting.kind).toBe(
      "hidden",
    );
  });

  test("open with no MVP at all: no card, but the entry is still there", () => {
    const view = ready({ ...E2_9_ROUND, mvp: null, mvpVoting: OPEN }, BALLOT);
    expect(view.mvp).toBeNull();
    expect(view.voting.kind).toBe("vote");
  });

  test("closed with votes: the winner, 'Escolhido pela galera', no entry, no number", () => {
    const view = ready({ ...E2_9_ROUND, mvp: VOTES_MVP, mvpVoting: CLOSED }, VOTED);
    expect(view.voting).toEqual({ kind: "hidden" });
    expect(view.mvp?.notes).toEqual([summaryStrings.mvpByVotesNote]);
    expect(JSON.stringify(view.mvp)).not.toMatch(/\d+ vot|voto|votante/i);
  });

  test("closed with nobody voting: by the stats, no entry", () => {
    const view = ready({ ...E2_9_ROUND, mvpVoting: CLOSED });
    expect(view.voting).toEqual({ kind: "hidden" });
    expect(view.mvp?.notes).toEqual([summaryStrings.mvpNote]);
  });

  test("an open voting with a ballot never leaks the vote into the view or the text", () => {
    const view = ready({ ...E2_9_ROUND, mvpVoting: OPEN }, VOTED);
    expect(JSON.stringify(view)).not.toContain(GABI);
    const text = summaryShareText(view).toLowerCase();
    for (const word of ["votou", "fecha", "resultado", " h.", "min"]) {
      expect(text).not.toContain(word);
    }
  });
});

describe("table 3.3 and the shared text of the sand", () => {
  const sand = (ranking: RoundSummaryReport["ranking"], modality = "beach-2x2") => ({
    ...E2_9_ROUND,
    modality,
    ranking,
    mvp: null,
  });
  const standing = (memberIds: string[], wins: number, losses: number, undecided = 0) => ({
    memberIds,
    wins,
    losses,
    undecided,
    longestWinStreak: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  });

  test("positions are 1 to n and never repeat, even with equal records", () => {
    const view = ready(
      sand([standing([BIA, GABI], 3, 1), standing([BIA], 3, 1), standing([GABI], 3, 1)]),
    );
    if (view.highlights.kind !== "ranking") throw new Error("ranking expected");
    expect(view.highlights.rows.map((row) => row.position)).toEqual([1, 2, 3]);
  });

  test("an empty or null ranking is an empty list, not a crash", () => {
    for (const ranking of [null, []]) {
      const view = ready(sand(ranking));
      expect(view.highlights).toEqual({ kind: "ranking", rows: [] });
      expect(summaryShareText(view)).not.toContain("Ranking do dia");
    }
  });

  test("header of a quartet round; singular '1 vitória' and '1 derrota'", () => {
    const view = ready(sand([standing([BIA, GABI], 1, 1, 1)], "beach-4x4"));
    expect(view.header).toBe("Racha · 4 partidas · quartetos");
    if (view.highlights.kind !== "ranking") throw new Error("ranking expected");
    expect(view.highlights.rows[0]?.record).toBe("1 vitória · 1 derrota · 1 sem vencedor");
  });

  test("a member unknown to the group still gets a name, never an ID", () => {
    const view = ready(sand([standing(["a0000000-0000-4000-8000-0000000000ff"], 1, 0)]));
    if (view.highlights.kind !== "ranking") throw new Error("ranking expected");
    expect(view.highlights.rows[0]?.name).toBe(summaryStrings.noName);
  });

  test("shared text: at most the limit of lines, a voted MVP by name, no vote data", () => {
    const many = Array.from({ length: SHARE_RANKING_LINES + 2 }, (_, i) =>
      standing([BIA, GABI], 9 - i, i),
    );
    const mvp: Mvp = { ...VOTES_MVP, memberIds: [GABI] };
    const view = ready({ ...sand(many), mvp, mvpVoting: CLOSED });
    const text = summaryShareText(view);
    expect(text).toContain("MVP do dia (escolhido pela galera): Gabi.");
    expect(text.match(/\d+\. /g)).toHaveLength(SHARE_RANKING_LINES);
    expect(text.toLowerCase()).not.toMatch(/votou|votaram|\d+ voto|fecha|prazo|resultado em/);
  });
});
