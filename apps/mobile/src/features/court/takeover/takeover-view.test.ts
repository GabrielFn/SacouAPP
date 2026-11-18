import { describe, expect, test } from "vitest";

import type { CourtSessionSummary } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { member } from "../../groups/model/members.test.fixture";
import { refusedTexts, takenOverTexts, writerNameOf } from "./takeover-texts";
import { takeOverView, type TakeOverInput } from "./takeover-view";
import { INITIAL_TAKEOVER_STATE } from "./takeover.reducer";

const LIA = "a0000000-0000-4000-8000-000000000001";
const MINUTE_MS = 60_000;
const SINCE = new Date(2026, 10, 18, 21, 14).toISOString();
const NOW = new Date(2026, 10, 18, 21, 30).getTime();
const FOUR_MINUTES_AGO = new Date(NOW - 4 * MINUTE_MS).toISOString();

const SUMMARY: CourtSessionSummary = {
  courtSessionId: "c0000000-0000-4000-8000-00000000000a",
  currentBatch: 1,
  eventCount: 23,
  writer: { memberId: LIA, since: SINCE },
  lastEventAt: FOUR_MINUTES_AGO,
  scoreboard: { matchId: "m", setNumber: 1, pointsA: 12, pointsB: 10, setsA: 0, setsB: 0 },
};
const MEMBERS = [member(LIA, "scorekeeper", { nickname: "Lia" })];
const FOUND: TakeOverInput = {
  lookup: { status: "found", summary: SUMMARY },
  refreshing: false,
  members: MEMBERS,
  state: INITIAL_TAKEOVER_STATE,
};
const { takeover, takenOver, refused } = strings.court;

describe("screen 09a, derived from the summary and the flow (D5)", () => {
  test("who marks, the last point four minutes ago, the score, and Assumir o placar", () => {
    expect(takeOverView(FOUND, NOW)).toEqual({
      card: {
        body: "Lia está marcando esta quadra. Se você assumir, o outro celular para de marcar.",
        lastPoint: "Último ponto que chegou, há 4 min",
        score: "Laranja 12 × 10 Azul",
      },
      backdrop: { a: 12, b: 10 },
      notice: null,
      action: { kind: "confirm" },
    });
  });

  test("without the name, the last point or a match open, the generic lines", () => {
    const quiet = { ...SUMMARY, lastEventAt: null, scoreboard: null };
    const input = { ...FOUND, lookup: { status: "found", summary: quiet }, members: [] } as const;
    const view = takeOverView(input, NOW);
    expect(view.card).toEqual({
      body: takeover.bodyUnnamed,
      lastPoint: takeover.noPointYet,
      score: takeover.noMatchOpen,
    });
    expect(view.backdrop).toBeNull();
  });

  test("a point under a minute ago reads as now", () => {
    const recent = { ...SUMMARY, lastEventAt: new Date(NOW - MINUTE_MS / 2).toISOString() };
    const view = takeOverView({ ...FOUND, lookup: { status: "found", summary: recent } }, NOW);
    expect(view.card?.lastPoint).toBe(takeover.lastPointNow);
  });

  test("reading, then busy while taking over and importing, never a second tap", () => {
    expect(takeOverView({ ...FOUND, lookup: undefined }, NOW).action).toEqual({ kind: "reading" });
    expect(takeOverView({ ...FOUND, refreshing: true }, NOW).action).toEqual({ kind: "reading" });
    expect(takeOverView({ ...FOUND, state: { status: "taking-over" } }, NOW).action).toEqual({
      kind: "busy",
      label: takeover.loading,
    });
    const importing = { status: "importing", imported: 200, total: 500 } as const;
    expect(takeOverView({ ...FOUND, state: importing }, NOW).action).toEqual({
      kind: "busy",
      label: "Carregando o placar... 200 de 500",
    });
    const done = { status: "done", courtSessionId: SUMMARY.courtSessionId } as const;
    expect(takeOverView({ ...FOUND, state: done }, NOW).action.kind).toBe("busy");
  });

  test("the stream moved: the new summary with the notice, and confirm again", () => {
    const state = { status: "confirming", streamChanged: true } as const;
    const view = takeOverView({ ...FOUND, state }, NOW);
    expect(view.notice).toBe(takeover.streamChanged);
    expect(view.action).toEqual({ kind: "confirm" });
  });

  test("failures say a closed text; the limit of changes has no Tentar de novo", () => {
    const failed = (reason: "import-invalid" | "writers-limit") =>
      takeOverView({ ...FOUND, state: { status: "failed", reason } }, NOW);
    expect(failed("import-invalid")).toMatchObject({
      notice: takeover.failures["import-invalid"],
      action: { kind: "retry" },
    });
    expect(failed("writers-limit")).toMatchObject({
      notice: "Esta quadra não aceita mais trocas de celular.",
      action: { kind: "none" },
    });
    expect(takeOverView({ ...FOUND, lookup: { status: "none" } }, NOW)).toMatchObject({
      card: null,
      notice: takeover.failures["not-found"],
      action: { kind: "none" },
    });
    const offline = { status: "failed", reason: "offline" } as const;
    expect(takeOverView({ ...FOUND, lookup: offline }, NOW)).toMatchObject({
      notice: takeover.failures.offline,
      action: { kind: "retry" },
    });
  });
});

describe("the texts of 09b and 09c (answer 83, D6)", () => {
  test("the name from the members cache, without an article; none without a nickname", () => {
    expect(writerNameOf(SUMMARY, MEMBERS)).toBe("Lia");
    expect(writerNameOf(SUMMARY, [member(LIA, "admin", { nickname: "  " })])).toBeNull();
    expect(writerNameOf(SUMMARY, undefined)).toBeNull();
    expect(writerNameOf(null, MEMBERS)).toBeNull();
  });

  test("09b with the name and the time, or the generic banner offline", () => {
    expect(takenOverTexts(SUMMARY, "Lia")).toEqual({
      title: "Lia assumiu o placar",
      body: "Às 21h14. Este celular parou de marcar.",
    });
    expect(takenOverTexts(null, null)).toEqual({ title: takenOver.title, body: takenOver.body });
  });

  test("09c: plural, the undo only, other phone first, and whom to ask", () => {
    expect(refusedTexts(1, false, SUMMARY, "Lia")).toEqual({
      title: "1 ponto não entrou",
      body: refused.bodyNamed("Lia", "21h14"),
      askFix: "Se algum valeu, peça para Lia corrigir na quadra.",
    });
    expect(refusedTexts(3, false, null, null)).toEqual({
      title: "3 pontos não entraram",
      body: refused.bodyUnnamed,
      askFix: refused.askFix,
    });
    expect(refusedTexts(0, false, null, null).title).toBe(refused.undoTitle);
    expect(refusedTexts(2, true, SUMMARY, "Lia").body).toBe(refused.bodyOtherFirst);
  });
});
