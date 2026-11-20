import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { ApiFailure, type ApiError } from "../../../services/api/api-error";
import type { Member, RoundSummaryReport } from "../../../services/api/sacou-api";
import { summaryStrings } from "../../../strings/summary.pt-BR";
import { BIA, E2_9_ROUND } from "./e2-9-round.test.fixture";
import { summaryView, type SummaryViewInput } from "./summary-view";

const MINUS = "−";
type Mvp = NonNullable<RoundSummaryReport["mvp"]>;

function member(memberId: string, nickname: string | null): Member {
  return {
    memberId,
    role: "player",
    memberType: "regular",
    hasAccount: true,
    isMe: false,
    joinedAt: "2026-11-01T00:00:00Z",
    nickname,
    primaryPosition: null,
    otherPositions: [],
  };
}

const MEMBERS = [member(BIA, "Bia")];

function input(report: RoundSummaryReport | undefined, rest: Partial<SummaryViewInput> = {}) {
  const base: SummaryViewInput = {
    query: { status: report === undefined ? "pending" : "success", data: report, error: null },
    groupName: "Racha de terça",
    members: MEMBERS,
    online: true,
    unsentPoints: 0,
  };
  return { ...base, ...rest };
}

function ready(report: RoundSummaryReport, rest: Partial<SummaryViewInput> = {}) {
  const view = summaryView(input(report, rest));
  if (view.kind !== "ready") throw new Error(`expected ready, got ${view.kind}`);
  return view;
}

function withSides(sides: RoundSummaryReport["sides"]): RoundSummaryReport {
  return { ...E2_9_ROUND, sides };
}

function withMvp(changes: Record<string, unknown>): RoundSummaryReport {
  return { ...E2_9_ROUND, mvp: { ...(E2_9_ROUND.mvp as Mvp), ...changes } as Mvp };
}

describe("the simulated round of the E2.9 (G1 to G5)", () => {
  test("G1 to G4: the numbers conferred by hand", () => {
    const view = ready(E2_9_ROUND);
    expect(view.header).toBe("Racha de terça · 4 partidas");
    expect(view.mvp).toEqual({
      name: "Bia",
      line: "Laranja · +2 de saldo · 2 vitórias em 3",
      byStats: true,
    });
    expect(view.highlights.mostWins).toMatchObject({
      title: "Time que mais venceu",
      label: "A Laranja",
      figure: "2 vitórias",
      color: "orange",
    });
    expect(view.highlights.longestStreak).toMatchObject({
      title: "Maior sequência",
      label: "A Laranja",
      figure: "2 seguidas",
    });
  });

  test("G5: the M4 won by b ties the highlights, the server sends null and both cards go", () => {
    const view = ready(withSides({ mostWins: null, longestStreak: null }));
    expect(view.highlights).toEqual({ kind: "teams", mostWins: null, longestStreak: null });
  });

  test("the fixture is the golden r1 of the server, field by field", () => {
    const path = join(
      __dirname,
      "../../../../../../packages/match-engine/golden/round-summary.json",
    );
    const golden = JSON.parse(readFileSync(path, "utf8")) as readonly {
      readonly id: string;
      readonly expected: { readonly roundSummary: Record<string, unknown> };
    }[];
    const summary = golden.find((item) => item.id.startsWith("r1-"))?.expected.roundSummary;
    expect(summary?.mvp).toEqual(E2_9_ROUND.mvp);
    expect(summary?.sides).toEqual(E2_9_ROUND.sides);
    expect((summary?.finishedMatches as readonly unknown[]).length).toBe(
      E2_9_ROUND.finishedMatches,
    );
  });

  test("the golden r17, with tied highlights, shows no highlight card", () => {
    const path = join(
      __dirname,
      "../../../../../../packages/match-engine/golden/round-summary.json",
    );
    const golden = JSON.parse(readFileSync(path, "utf8")) as readonly {
      readonly id: string;
      readonly expected: { readonly roundSummary: { readonly sides: RoundSummaryReport["sides"] } };
    }[];
    const sides = golden.find((item) => item.id.startsWith("r17-"))?.expected.roundSummary.sides;
    const view = ready(withSides(sides as RoundSummaryReport["sides"]));
    expect(view.highlights.mostWins).toBeNull();
    expect(view.highlights.longestStreak).toMatchObject({ label: "B Azul" });
  });
});

describe("texts (T1, T2)", () => {
  test.each([
    [34, "+34 de saldo"],
    [1, "+1 de saldo"],
    [0, "0 de saldo"],
    [-1, `${MINUS}1 de saldo`],
    [-2, `${MINUS}2 de saldo`],
  ])("T1: the balance %i reads %s", (plusMinus, text) => {
    expect(ready(withMvp({ plusMinus })).mvp?.line).toContain(text);
  });

  test("T2: plurals of matches, wins and streaks", () => {
    expect(ready({ ...E2_9_ROUND, finishedMatches: 1 }).header).toBe("Racha de terça · 1 partida");
    expect(summaryStrings.winsOf(1, 1)).toBe("1 vitória em 1");
    expect(summaryStrings.winsOf(0, 2)).toBe("0 vitórias em 2");
    expect(summaryStrings.streak(1)).toBe("1 seguida");
  });

  test("T2: with one highlight null the other stays", () => {
    const view = ready(
      withSides({ mostWins: null, longestStreak: { side: "b", longestWinStreak: 3 } }),
    );
    expect(view.highlights.mostWins).toBeNull();
    expect(view.highlights.longestStreak).toMatchObject({ label: "B Azul", color: "blue" });
  });
});

describe("who is shown (T3, T5, T8, T9)", () => {
  test("T3: without an MVP there is no dark card and the team cards stay", () => {
    const view = ready({ ...E2_9_ROUND, mvp: null });
    expect(view.mvp).toBeNull();
    expect(view.highlights.mostWins).not.toBeNull();
  });

  test("T5: a member without a name reads Jogador, never the ID", () => {
    expect(ready(E2_9_ROUND, { members: [member(BIA, null)] }).mvp?.name).toBe("Jogador");
    expect(ready(E2_9_ROUND, { members: [] }).mvp?.name).toBe("Jogador");
    expect(ready(E2_9_ROUND, { members: undefined }).mvp?.name).toBe("Jogador");
  });

  test("T8: a team of the sand has no dark card, the cards of teams stay", () => {
    const view = ready({
      ...withMvp({ kind: "team", memberIds: [BIA, "x"] }),
      modality: "beach-2x2",
    });
    expect(view.mvp).toBeNull();
    expect(view.highlights.kind).toBe("teams");
  });

  test("T9: an MVP of the votes hides the note, a missing source counts as the stats", () => {
    expect(ready(withMvp({ source: "votes" })).mvp?.byStats).toBe(false);
    expect(ready(E2_9_ROUND).mvp?.byStats).toBe(true);
  });

  test("the side is left out of the line when the server sends none", () => {
    expect(ready(withMvp({ side: null })).mvp?.line).toBe("+2 de saldo · 2 vitórias em 3");
  });
});

describe("states (T4, T6, T7)", () => {
  const failed = (error: ApiError, data?: RoundSummaryReport): SummaryViewInput =>
    input(data, { query: { status: "error", data, error: new ApiFailure(error) } });

  test("T4: no match finished is the empty state", () => {
    const view = summaryView(input({ ...E2_9_ROUND, finishedMatches: 0 }));
    expect(view).toEqual({ kind: "empty", header: "Racha de terça · 0 partidas" });
  });

  test("T6: loading, offline without cache, and the errors with their texts", () => {
    expect(summaryView(input(undefined)).kind).toBe("loading");
    expect(summaryView(input(undefined, { online: false })).kind).toBe("offline-empty");
    expect(summaryView(failed({ kind: "offline" })).kind).toBe("offline-empty");
    const notFound = summaryView(
      failed({ kind: "problem", status: 404, code: "sessions.round-not-found" }),
    );
    expect(notFound).toEqual({ kind: "error", text: "Essa rodada não existe mais." });
    expect(summaryView(failed({ kind: "rate-limited", retryAfterMs: 1000 })).kind).toBe("error");
  });

  test("T6: offline with the cache keeps the last summary and says so", () => {
    expect(summaryView(failed({ kind: "offline" }, E2_9_ROUND))).toMatchObject({
      kind: "ready",
      stale: true,
    });
    expect(ready(E2_9_ROUND).stale).toBe(false);
  });

  test("T7: points not sent warn, in the singular too", () => {
    expect(ready(E2_9_ROUND).unsentNote).toBeNull();
    expect(ready(E2_9_ROUND, { unsentPoints: 3 }).unsentNote).toBe(
      "Ainda faltam 3 pontos para enviar. O resumo pode mudar.",
    );
    expect(ready(E2_9_ROUND, { unsentPoints: 1 }).unsentNote).toBe(
      "Ainda falta 1 ponto para enviar. O resumo pode mudar.",
    );
  });
});

describe("the rating never shows (R1 to R3)", () => {
  const FORBIDDEN = ["rating", "mu", "sigma", "level", "levelTenths", "nota", "ordinal"];

  test("R1: no key of the summary contract is a rating", () => {
    const schema = readFileSync(join(__dirname, "../../../api/generated/schema.ts"), "utf8");
    const names = [
      "RoundSummaryReport",
      "SummaryMvpReport",
      "SummarySidesReport",
      "SummaryMostWinsReport",
      "SummaryLongestStreakReport",
      "SummaryPlayerReport",
      "SummaryPointsByKindReport",
      "SummaryStandingReport",
    ];
    const keys = names.flatMap((name) => {
      const start = schema.indexOf(`    ${name}: {`);
      expect(start).toBeGreaterThan(-1);
      const block = schema.slice(start, schema.indexOf("\n    };", start));
      return [...block.matchAll(/^\s{6}(\w+)\??:/gmu)].map((match) => match[1] ?? "");
    });
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((key) => FORBIDDEN.includes(key))).toEqual([]);
  });

  test("R2: a leaked rating field reaches no text of the view", () => {
    const leaked = {
      ...withMvp({ mu: 25, sigma: 8.3, level: 4.5 }),
      rating: 31.2,
    } as RoundSummaryReport;
    expect(JSON.stringify(ready(leaked))).not.toMatch(/31\.2|8\.3|4\.5|rating|sigma/u);
  });

  test("R3: no text of the screen speaks of grade, level or rating", () => {
    const all = JSON.stringify([
      summaryStrings.title,
      summaryStrings.unsent(2),
      summaryStrings.mvpNote,
      summaryStrings.staleNote,
      summaryStrings.emptyTitle,
      summaryStrings.offlineBody,
    ]);
    expect(all.toLowerCase()).not.toMatch(/nota|nível|nivel|rating/u);
  });
});
