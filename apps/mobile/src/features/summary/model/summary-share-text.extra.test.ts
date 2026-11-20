import { describe, expect, test } from "vitest";

import { E2_9_ROUND } from "./e2-9-round.test.fixture";
import { summaryShareText } from "./summary-share-text";
import { summaryView } from "./summary-view";

const FORBIDDEN = /https?:|www\.|nota|rating|n[ií]vel|undefined|null|NaN/i;

function text(report: typeof E2_9_ROUND): string {
  const view = summaryView({
    query: { status: "success", data: report, error: null },
    groupName: "Racha",
    members: [],
    online: true,
    unsentPoints: 0,
  });
  if (view.kind !== "ready") throw new Error(view.kind);
  return summaryShareText(view);
}

describe("summaryShareText: extra (E6)", () => {
  test("a null mvp and null highlights leave only the intro", () => {
    const out = text({ ...E2_9_ROUND, mvp: null, sides: { mostWins: null, longestStreak: null } });
    expect(out).toMatch(/^Resumo do Racha · \d+ partidas?\.$/);
    expect(out).not.toMatch(FORBIDDEN);
    expect(out).not.toContain("  ");
  });

  test("the full text has no link, rating, note or placeholder either", () => {
    expect(text(E2_9_ROUND)).not.toMatch(FORBIDDEN);
  });

  test("only one highlight null leaves only the other", () => {
    const out = text({ ...E2_9_ROUND, sides: { ...E2_9_ROUND.sides, longestStreak: null } });
    expect(out).toContain("Time que mais venceu");
    expect(out).not.toContain("Maior sequência");
  });
});
