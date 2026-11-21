import { describe, expect, test } from "vitest";

import type { ApiError } from "../../../../services/api/api-error";
import {
  canSubmit,
  INITIAL_MVP_VOTE,
  mvpVoteReducer,
  type MvpVoteAction,
  type MvpVoteState,
} from "./mvp-vote.reducer";

const CLOSED: ApiError = { kind: "problem", status: 422, code: "stats.mvp-voting-closed" };

function run(actions: readonly MvpVoteAction[], from: MvpVoteState = INITIAL_MVP_VOTE) {
  return actions.reduce(mvpVoteReducer, from);
}

describe("the choice and the sending of the vote", () => {
  test("B1 choose, change the choice and send", () => {
    const state = run([
      { type: "candidate-selected", memberId: "m-bia" },
      { type: "candidate-selected", memberId: "m-gabi" },
      { type: "submit-requested" },
    ]);
    expect(state).toEqual({ selected: "m-gabi", phase: "submitting", error: null });
  });

  test("S6 nothing is chosen at first", () => {
    expect(INITIAL_MVP_VOTE.selected).toBeNull();
    expect(canSubmit(INITIAL_MVP_VOTE, true)).toBe(false);
  });

  test("B2 sending with nobody chosen changes nothing", () => {
    expect(run([{ type: "submit-requested" }])).toBe(INITIAL_MVP_VOTE);
  });

  test("B3 a second tap while sending changes nothing, nor a new choice", () => {
    const sending = run([
      { type: "candidate-selected", memberId: "m-bia" },
      { type: "submit-requested" },
    ]);
    expect(mvpVoteReducer(sending, { type: "submit-requested" })).toBe(sending);
    expect(mvpVoteReducer(sending, { type: "candidate-selected", memberId: "m-leo" })).toBe(
      sending,
    );
    expect(canSubmit(sending, true)).toBe(false);
  });

  test("B4 a refusal keeps the code and the choice; dismissing goes back to choosing", () => {
    const failed = run([
      { type: "candidate-selected", memberId: "m-bia" },
      { type: "submit-requested" },
      { type: "submit-failed", error: CLOSED },
    ]);
    expect(failed).toEqual({ selected: "m-bia", phase: "failed", error: CLOSED });
    expect(canSubmit(failed, true)).toBe(true);
    expect(mvpVoteReducer(failed, { type: "error-dismissed" })).toEqual({
      selected: "m-bia",
      phase: "choosing",
      error: null,
    });
  });

  test("B4 a new choice after a refusal clears the refusal", () => {
    const failed: MvpVoteState = { selected: "m-bia", phase: "failed", error: CLOSED };
    expect(mvpVoteReducer(failed, { type: "candidate-selected", memberId: "m-gabi" })).toEqual({
      selected: "m-gabi",
      phase: "choosing",
      error: null,
    });
  });

  test("B5 the vote that went clears the choice: the cache holds it from then on", () => {
    const state = run([
      { type: "candidate-selected", memberId: "m-bia" },
      { type: "submit-requested" },
      { type: "submit-succeeded" },
    ]);
    expect(state).toEqual(INITIAL_MVP_VOTE);
  });

  test("a late refusal outside the sending, or dismissing nothing, changes nothing", () => {
    const choosing = run([{ type: "candidate-selected", memberId: "m-bia" }]);
    expect(mvpVoteReducer(choosing, { type: "submit-failed", error: CLOSED })).toBe(choosing);
    expect(mvpVoteReducer(choosing, { type: "error-dismissed" })).toBe(choosing);
  });

  test("without a network the vote does not go (question 172)", () => {
    const choosing = run([{ type: "candidate-selected", memberId: "m-bia" }]);
    expect(canSubmit(choosing, false)).toBe(false);
  });
});
