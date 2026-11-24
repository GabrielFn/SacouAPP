import { describe, expect, test } from "vitest";

import type { Member, RoundSummaryReport } from "../../../services/api/sacou-api";
import { mvpVoteStrings } from "../../../strings/mvp-vote.pt-BR";
import { summaryStrings } from "../../../strings/summary.pt-BR";
import { BIA, E2_9_ROUND } from "./e2-9-round.test.fixture";
import { SHARE_RANKING_LINES, summaryShareText } from "./summary-share-text";
import { summaryView, type ReadySummary } from "./summary-view";

const GABI = "a0000000-0000-4000-8000-000000000002";
const CAIO = "a0000000-0000-4000-8000-000000000003";
const LEO = "a0000000-0000-4000-8000-000000000004";
const LIA = "a0000000-0000-4000-8000-000000000005";
const NINA = "a0000000-0000-4000-8000-000000000006";
const NAMES: Readonly<Record<string, string>> = {
  [BIA]: "Bia",
  [GABI]: "Gabi",
  [CAIO]: "Caio",
  [LEO]: "Léo",
  [LIA]: "Lia",
  [NINA]: "Nina",
};
const MEMBERS: readonly Member[] = Object.entries(NAMES).map(([memberId, nickname]) => ({
  memberId,
  role: "player",
  memberType: "regular",
  hasAccount: true,
  isMe: false,
  joinedAt: "2026-11-01T00:00:00Z",
  nickname,
  primaryPosition: null,
  otherPositions: [],
}));

type Standing = NonNullable<RoundSummaryReport["ranking"]>[number];
type Mvp = NonNullable<RoundSummaryReport["mvp"]>;

function standing(memberIds: string[], wins: number, losses: number, undecided = 0): Standing {
  return {
    memberIds,
    wins,
    losses,
    undecided,
    longestWinStreak: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };
}

const TEAM_MVP: Mvp = {
  source: "stats",
  kind: "team",
  memberIds: [BIA, GABI],
  side: null,
  plusMinus: 0,
  wins: 7,
  matchesPlayed: 9,
  longestWinStreak: 4,
};

const SAND: RoundSummaryReport = {
  ...E2_9_ROUND,
  modality: "beach-2x2",
  finishedMatches: 9,
  mvp: TEAM_MVP,
  ranking: [
    standing([BIA, GABI], 7, 2),
    standing([CAIO, LEO], 5, 4),
    standing([LIA, NINA], 4, 5),
    standing([BIA, LEO], 2, 7),
  ],
};

const OPEN_VOTING = {
  state: "open",
  opensAt: "2026-11-20T00:00:00Z",
  closesAt: "2026-11-21T00:00:00Z",
} as const;

function withVotes(changes: Partial<Mvp>): RoundSummaryReport {
  return { ...E2_9_ROUND, mvp: { ...(E2_9_ROUND.mvp as Mvp), source: "votes", ...changes } };
}

function ready(report: RoundSummaryReport): ReadySummary {
  const view = summaryView({
    query: { status: "success", data: report, error: null },
    groupName: "Areia de sábado",
    members: MEMBERS,
    online: true,
    unsentPoints: 0,
    ballot: undefined,
    nowMs: 0,
  });
  if (view.kind !== "ready") throw new Error(`expected ready, got ${view.kind}`);
  return view;
}

function rows(report: RoundSummaryReport) {
  const { highlights } = ready(report);
  if (highlights.kind !== "ranking") throw new Error("expected the ranking");
  return highlights.rows;
}

describe("screen 12b, the ranking of the sand (A1 to A6)", () => {
  test("A1: four rows in the order of the server, with the record of each team", () => {
    expect(rows(SAND).map((row) => [row.position, row.name, row.record])).toEqual([
      [1, "Bia e Gabi", "7 vitórias · 2 derrotas"],
      [2, "Caio e Léo", "5 vitórias · 4 derrotas"],
      [3, "Lia e Nina", "4 vitórias · 5 derrotas"],
      [4, "Bia e Léo", "2 vitórias · 7 derrotas"],
    ]);
  });

  test("A2: a quartet lists every name; a remade team is another row", () => {
    const quartet = {
      ...SAND,
      modality: "beach-4x4",
      ranking: [standing([BIA, GABI, CAIO, LEO], 3, 1)],
    };
    expect(rows(quartet)[0]?.name).toBe("Bia, Gabi, Caio e Léo");
    expect(new Set(rows(SAND).map((row) => row.key)).size).toBe(4);
  });

  test("A3 and A4: a match without a winner is said; singular forms", () => {
    const report = { ...SAND, ranking: [standing([BIA, GABI], 1, 0, 1)] };
    expect(rows(report)[0]?.record).toBe("1 vitória · 0 derrotas · 1 sem vencedor");
  });

  test("A5: the header says pairs or quartets", () => {
    expect(ready(SAND).header).toBe("Areia de sábado · 9 partidas · duplas");
    expect(ready({ ...SAND, modality: "beach-4x4" }).header).toBe(
      "Areia de sábado · 9 partidas · quartetos",
    );
    expect(ready(E2_9_ROUND).header).toBe("Areia de sábado · 4 partidas");
  });

  test("A6: the sand never has the team cards", () => {
    expect(ready(SAND).highlights.kind).toBe("ranking");
    expect(ready(E2_9_ROUND).highlights.kind).toBe("teams");
  });
});

describe("the MVP of a team and of the votes (M1 to M3)", () => {
  test("M1: a team shows both names and the streak only from 2 on", () => {
    expect(ready(SAND).mvp).toMatchObject({
      name: "Bia e Gabi",
      line: "7 vitórias · ficaram 4 seguidas na quadra",
      detail: "7 vitórias",
    });
    const short = ready({ ...SAND, mvp: { ...TEAM_MVP, longestWinStreak: 1 } }).mvp;
    expect(short?.line).toBe("7 vitórias");
  });

  test("M2: the votes name the winner, or both in a tie, and say who chose", () => {
    const one = ready(withVotes({})).mvp;
    expect(one).toMatchObject({ name: "Bia", notes: [summaryStrings.mvpByVotesNote] });
    expect(one?.line).toBe("Laranja · +2 de saldo · 2 vitórias em 3");
    const tie = ready(withVotes({ memberIds: [BIA, GABI] })).mvp;
    expect(tie).toMatchObject({ name: "Bia e Gabi", line: null, detail: null });
  });

  test("M3: nobody voted, the MVP is by the stats", () => {
    expect(ready(E2_9_ROUND).mvp?.notes).toEqual([summaryStrings.mvpNote]);
  });

  test("an open voting adds its note to the MVP by the stats", () => {
    const mvp = ready({ ...E2_9_ROUND, mvpVoting: OPEN_VOTING }).mvp;
    expect(mvp?.title).toBe(summaryStrings.provisionalTitle);
    expect(mvp?.notes).toHaveLength(1);
    expect(mvp?.notes[0]).toMatch(/^A galera decide até (hoje|amanhã), \d{2}h\d{2}$/u);
  });
});

describe("the shared text of the sand and of the votes (S5)", () => {
  test("the ranking goes in up to the limit of lines", () => {
    expect(summaryShareText(ready(SAND))).toBe(
      "Resumo do Areia de sábado · 9 partidas · duplas. MVP do dia: Bia e Gabi (7 vitórias). " +
        "Ranking do dia: 1. Bia e Gabi, 7-2; 2. Caio e Léo, 5-4; 3. Lia e Nina, 4-5; 4. Bia e Léo, 2-7.",
    );
    const many = Array.from({ length: SHARE_RANKING_LINES + 3 }, (_, index) =>
      standing([BIA, String(index)], index, 0),
    );
    const text = summaryShareText(ready({ ...SAND, ranking: many }));
    expect(text.match(/\d+\. /g)).toHaveLength(SHARE_RANKING_LINES);
  });

  test("S5: the winner of the votes is named; an open voting says who leads and until when, never a vote", () => {
    expect(summaryShareText(ready(withVotes({})))).toContain(
      "MVP do dia (escolhido pela galera): Bia.",
    );
    const open = summaryShareText(ready({ ...E2_9_ROUND, mvpVoting: OPEN_VOTING }));
    expect(open).toMatch(
      /Na frente pelo placar: .* A galera decide o MVP até (hoje|amanhã), \d{2}h\d{2}\./u,
    );
    for (const word of ["votou", "voto", "resultado"]) {
      expect(open.toLowerCase()).not.toContain(word);
    }
  });

  test("S1: the strings of the summary and of the entry never count votes", () => {
    const texts = [
      ...Object.values(summaryStrings).filter((value) => typeof value === "string"),
      mvpVoteStrings.entryVote("23 h"),
      mvpVoteStrings.entryVoted("23 h"),
      mvpVoteStrings.entryNotOpen,
    ].join("\n");
    expect(texts).not.toMatch(/\d+ vot|votaram|votantes/i);
  });
});
