import { describe, expect, test } from "vitest";

import type { Member, RoundSummaryReport } from "../../../services/api/sacou-api";
import { BIA, E2_9_ROUND } from "./e2-9-round.test.fixture";
import { summaryShareText } from "./summary-share-text";
import { summaryView } from "./summary-view";

const MEMBERS: readonly Member[] = [
  {
    memberId: BIA,
    role: "player",
    memberType: "regular",
    hasAccount: true,
    isMe: false,
    joinedAt: "2026-11-01T00:00:00Z",
    nickname: "Bia",
    primaryPosition: null,
    otherPositions: [],
  },
];

function textOf(report: RoundSummaryReport): string {
  const view = summaryView({
    query: { status: "success", data: report, error: null },
    groupName: "Racha de terça",
    members: MEMBERS,
    online: true,
    unsentPoints: 0,
    ballot: undefined,
    nowMs: 0,
  });
  if (view.kind !== "ready") throw new Error(`expected ready, got ${view.kind}`);
  return summaryShareText(view);
}

describe("summaryShareText (E6, G1 to G5)", () => {
  test("G1 to G4: the sentence of the plan", () => {
    expect(textOf(E2_9_ROUND)).toBe(
      "Resumo do Racha de terça · 4 partidas. MVP do dia: Bia (+2 de saldo, 2 vitórias em 3). " +
        "Time que mais venceu: A Laranja, 2 vitórias. Maior sequência: A Laranja, 2 seguidas.",
    );
  });

  test("G5: a highlight that is null stays out of the text", () => {
    const text = textOf({ ...E2_9_ROUND, sides: { mostWins: null, longestStreak: null } });
    expect(text).toBe(
      "Resumo do Racha de terça · 4 partidas. MVP do dia: Bia (+2 de saldo, 2 vitórias em 3).",
    );
  });

  test("T3: without an MVP the text keeps only the teams", () => {
    expect(textOf({ ...E2_9_ROUND, mvp: null })).not.toContain("MVP");
  });

  test("R2 and R3: a leaked rating never reaches the text, and no word of rating is in it", () => {
    const leaked = { ...E2_9_ROUND, rating: 1500, mu: 25 } as RoundSummaryReport;
    const text = textOf(leaked);
    expect(text).not.toMatch(/1500|nota|n[ií]vel|rating|http/i);
  });
});
