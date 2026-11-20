import { describe, expect, test } from "vitest";

import type { RoundSummaryReport } from "../../../services/api/sacou-api";
import { E2_9_ROUND } from "./e2-9-round.test.fixture";
import { summaryView, type SummaryViewInput } from "./summary-view";

type Mvp = NonNullable<RoundSummaryReport["mvp"]>;

const INPUT: Omit<SummaryViewInput, "query"> = {
  groupName: "Racha de terça",
  members: [],
  online: true,
  unsentPoints: 0,
};

function ready(report: RoundSummaryReport) {
  const view = summaryView({
    ...INPUT,
    query: { status: "success", data: report, error: null },
  });
  if (view.kind !== "ready") throw new Error(`expected ready, got ${view.kind}`);
  return view;
}

describe("extra cases of the summary view (tester, E4.12 part 1)", () => {
  test("both highlights tied: no team card, the MVP card stays", () => {
    const view = ready({ ...E2_9_ROUND, sides: { mostWins: null, longestStreak: null } });
    expect(view.highlights.mostWins).toBeNull();
    expect(view.highlights.longestStreak).toBeNull();
    expect(view.mvp).not.toBeNull();
  });

  test("the MVP side b reads Azul in the line, a reads Laranja", () => {
    const withSide = (side: "a" | "b") =>
      ready({ ...E2_9_ROUND, mvp: { ...E2_9_ROUND.mvp, side } as Mvp }).mvp?.line;
    expect(withSide("b")).toMatch(/^Azul · /);
    expect(withSide("a")).toMatch(/^Laranja · /);
  });

  test("an MVP without any player id shows no card", () => {
    expect(
      ready({ ...E2_9_ROUND, mvp: { ...E2_9_ROUND.mvp, memberIds: [] } as Mvp }).mvp,
    ).toBeNull();
  });

  test("the sand 4x4 with an MVP and sides does not break the view", () => {
    const view = ready({ ...E2_9_ROUND, modality: "beach-4x4" });
    expect(view.highlights.kind).toBe("teams");
  });

  test("a highlight of side b carries the color of side b, different from a", () => {
    const a = ready({
      ...E2_9_ROUND,
      sides: {
        mostWins: { side: "a", wins: 2 },
        longestStreak: { side: "b", longestWinStreak: 1 },
      },
    });
    expect(a.highlights.mostWins?.color).not.toEqual(a.highlights.longestStreak?.color);
    expect(a.highlights.longestStreak?.figure).toBe("1 seguida");
    expect(a.highlights.mostWins?.figure).toBe("2 vitórias");
  });
});
