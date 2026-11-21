import { describe, expect, test } from "vitest";

import { ApiFailure, type ApiError } from "../../../../services/api/api-error";
import type { MvpBallot } from "../../../../services/api/sacou-api";
import { orderBallot } from "./ballot-order";
import { candidateLine } from "./candidate-line";
import { ballot, CANDIDATES, MEMBERS, NOW, SCENARIOS } from "./mvp-ballot.test.fixture";
import { mvpVoteView, type ChoosingView, type MvpVoteViewInput } from "./mvp-vote-view";
import { INITIAL_MVP_VOTE, type MvpVoteState } from "./mvp-vote.reducer";
import { localTimeText, remainingText } from "./voting-deadline";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function input(overrides: Partial<MvpVoteViewInput> = {}): MvpVoteViewInput {
  return {
    query: { status: "success", data: SCENARIOS.open, error: null },
    members: MEMBERS,
    online: true,
    nowMs: NOW,
    vote: INITIAL_MVP_VOTE,
    ...overrides,
  };
}

function withData(data: MvpBallot, overrides: Partial<MvpVoteViewInput> = {}) {
  return mvpVoteView(input({ query: { status: "success", data, error: null }, ...overrides }));
}

function failedWith(error: ApiError) {
  return mvpVoteView(
    input({ query: { status: "error", data: undefined, error: new ApiFailure(error) } }),
  );
}

function choosingOf(overrides: Partial<MvpVoteViewInput> = {}): ChoosingView {
  const { body } = mvpVoteView(input(overrides));
  if (body.kind !== "choosing") throw new Error(`expected choosing, got ${body.kind}`);
  return body;
}

const chosen = (memberId: string): MvpVoteState => ({ ...INITIAL_MVP_VOTE, selected: memberId });

describe("the states of screen 12a (V1)", () => {
  test.each([
    ["open", SCENARIOS.open, "choosing"],
    ["notOpen", SCENARIOS.notOpen, "not-open"],
    ["closed", SCENARIOS.closed, "closed"],
    ["voted", SCENARIOS.voted, "already-voted"],
    ["notPlayed", SCENARIOS.notPlayed, "not-eligible"],
  ] as const)("%s gives %s", (_name, data, kind) => {
    expect(withData(data).body.kind).toBe(kind);
  });

  test("loading, offline with nothing seen, and an error of the server", () => {
    const pending = { status: "pending" as const, data: undefined, error: null };
    expect(mvpVoteView(input({ query: pending })).body.kind).toBe("loading");
    expect(mvpVoteView(input({ query: pending, online: false })).body.kind).toBe("offline-empty");
    expect(failedWith({ kind: "offline" }).body.kind).toBe("offline-empty");
    expect(failedWith({ kind: "unavailable", retryAfterMs: 0 }).body.kind).toBe("error");
    expect(
      failedWith({ kind: "problem", status: 404, code: "sessions.round-not-found" }).body.kind,
    ).toBe("error");
  });

  test("V5 404 mvp-voting-off is its own state, not an error", () => {
    expect(
      failedWith({ kind: "problem", status: 404, code: "stats.mvp-voting-off" }).body.kind,
    ).toBe("voting-off");
  });

  test("V2 open with canVote shows the ballot in the order of the canvas", () => {
    const view = choosingOf();
    expect(view.rows.map((row) => row.name)).toEqual([
      "Bia",
      "Gabi",
      "Caio",
      "Lia",
      "Marcos",
      "Nina",
      "Léo",
    ]);
    expect(view.rows[0]).toMatchObject({ initials: "BI", line: "Laranja · 5 partidas · +34" });
    expect(view.deadline).toBe("Voto secreto · fecha em 23 h");
    expect(view.footerLabel).toBe("Escolha quem foi o MVP");
    expect(view.canSubmit).toBe(false);
  });

  test("a choice names the button and lets it send", () => {
    const view = choosingOf({ vote: chosen("m-bia") });
    expect(view.footerLabel).toBe("Votar em Bia");
    expect(view.canSubmit).toBe(true);
    expect(view.rows.filter((row) => row.selected).map((row) => row.memberId)).toEqual(["m-bia"]);
  });

  test("a choice that left the ballot is no choice", () => {
    const view = choosingOf({ vote: chosen("m-gone") });
    expect(view.canSubmit).toBe(false);
    expect(view.footerLabel).toBe("Escolha quem foi o MVP");
  });

  test("V3 the server's own vote wins over canVote and over a choice made here", () => {
    const data = ballot({
      canVote: true,
      myVote: { candidateMemberId: "m-gabi", castAt: "2026-11-20T03:00:00.000Z" },
    });
    expect(withData(data, { vote: chosen("m-bia") }).body).toEqual({
      kind: "already-voted",
      voted: "Você votou em Gabi. Seu voto é secreto.",
      result: "O resultado sai quando a votação fechar, em 23 h.",
    });
  });

  test("already voted without the vote in the answer says it without a name", () => {
    const data = ballot({ canVote: false, reason: "alreadyVoted" });
    expect(withData(data).body).toMatchObject({ voted: "Você já votou. Seu voto é secreto." });
  });

  test("V4 who did not play sees no ballot, only the deadline", () => {
    expect(withData(SCENARIOS.notPlayed).body).toEqual({ kind: "not-eligible", closesIn: "23 h" });
  });

  test("not open says when it opens, in the time of the phone", () => {
    const opensAt = new Date(2026, 10, 20, 2, 30).toISOString();
    expect(withData(ballot({ state: "notOpen", opensAt })).body).toEqual({
      kind: "not-open",
      opensAt: "Abre às 02h30",
    });
  });

  test("V6 offline with the ballot in memory: shown as stale, the button does not send", () => {
    const view = mvpVoteView(input({ online: false, vote: chosen("m-bia") }));
    expect(view.stale).toBe(true);
    expect(view.body).toMatchObject({
      kind: "choosing",
      canSubmit: false,
      footerLabel: "Conecte-se para votar",
    });
  });

  test("a failed read again keeps the last ballot, stale", () => {
    const failure = new ApiFailure({ kind: "offline" });
    const view = mvpVoteView(
      input({ query: { status: "error", data: SCENARIOS.open, error: failure } }),
    );
    expect(view.stale).toBe(true);
    expect(view.body.kind).toBe("choosing");
  });

  test("D5 a network failure of the vote keeps the choice, with a text to try again", () => {
    const vote: MvpVoteState = { selected: "m-bia", phase: "failed", error: { kind: "offline" } };
    const view = choosingOf({ vote });
    expect(view.errorText).toBe("Sem conexão. Tente de novo.");
    expect(view.canSubmit).toBe(true);
  });

  test("D4 a refused candidate is told without the name", () => {
    const error: ApiError = { kind: "problem", status: 422, code: "stats.mvp-candidate-invalid" };
    const view = choosingOf({ vote: { selected: "m-bia", phase: "failed", error } });
    expect(view.errorText).not.toBeNull();
    expect(view.errorText).not.toContain("Bia");
  });

  test("while sending the button is busy and does not send again", () => {
    const view = choosingOf({ vote: { selected: "m-bia", phase: "submitting", error: null } });
    expect(view).toMatchObject({ submitting: true, canSubmit: false });
  });

  test("a member without a nickname reads as Jogador", () => {
    const view = choosingOf({ members: undefined });
    expect(view.rows.every((row) => row.name === "Jogador")).toBe(true);
  });
});

describe("the ballot and the deadline", () => {
  test("D7 more matches first, then more balance, from a shuffled list", () => {
    expect(orderBallot(CANDIDATES).map((c) => [c.matchesPlayed, c.plusMinus])).toEqual([
      [5, 34],
      [5, 21],
      [4, 6],
      [4, -2],
      [3, 9],
      [3, -11],
      [2, -8],
    ]);
  });

  test("D7 a full tie keeps the order of the server", () => {
    const tied = ["x", "y", "z"].map((memberId) => ({
      memberId,
      matchesPlayed: 3,
      plusMinus: 2,
      wins: 1,
      mainSide: null,
    }));
    expect(orderBallot(tied).map((c) => c.memberId)).toEqual(["x", "y", "z"]);
  });

  test("D8 the line of a candidate on the court and on the sand", () => {
    expect(candidateLine({ mainSide: "a", matchesPlayed: 5, plusMinus: 34 })).toBe(
      "Laranja · 5 partidas · +34",
    );
    expect(candidateLine({ mainSide: "b", matchesPlayed: 4, plusMinus: -2 })).toBe(
      "Azul · 4 partidas · −2",
    );
    expect(candidateLine({ mainSide: null, matchesPlayed: 5, plusMinus: 34 })).toBe(
      "5 partidas · +34",
    );
    expect(candidateLine({ mainSide: null, matchesPlayed: 1, plusMinus: 0 })).toBe("1 partida · 0");
  });

  test.each([
    [23 * HOUR + 59 * MINUTE, "23 h"],
    [HOUR, "1 h"],
    [59 * MINUTE + 30_000, "59 min"],
    [30_000, "1 min"],
    [-HOUR, "1 min"],
  ])("D9 %d ms left reads %s", (left, text) => {
    expect(remainingText(NOW + left, NOW)).toBe(text);
  });

  test("D9 the hour of an instant in the time zone of the phone", () => {
    expect(localTimeText(new Date(2026, 10, 20, 2, 30))).toBe("02h30");
    expect(localTimeText(new Date(2026, 10, 20, 22, 5))).toBe("22h05");
  });
});
