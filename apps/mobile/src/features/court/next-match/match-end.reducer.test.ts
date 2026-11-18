import { describe, expect, test } from "vitest";

import { EMPTY_NEXT_MATCH_DRAFT } from "../ports/next-match-draft-store";
import { INITIAL_MATCH_END, matchEndReducer, type MatchEndState } from "./match-end.reducer";

const READY: MatchEndState = matchEndReducer(INITIAL_MATCH_END, {
  type: "loaded",
  origin: null,
  draft: EMPTY_NEXT_MATCH_DRAFT,
});

function chosenB(state: MatchEndState) {
  return state.status === "ready" ? state.draft.chosen.b : null;
}

describe("the state of screen 11", () => {
  test("nothing happens before the draft is loaded", () => {
    expect(matchEndReducer(INITIAL_MATCH_END, { type: "start-requested" })).toBe(INITIAL_MATCH_END);
  });

  test("a tap picks, a second unpicks, and a full pick takes no one else", () => {
    const toggle = (state: MatchEndState, memberId: string) =>
      matchEndReducer(state, { type: "member-toggled", side: "b", memberId, required: 2 });
    const two = toggle(toggle(READY, "m1"), "m2");
    expect(chosenB(two)).toEqual(["m1", "m2"]);
    expect(chosenB(toggle(two, "m3"))).toEqual(["m1", "m2"]);
    expect(chosenB(toggle(two, "m1"))).toEqual(["m2"]);
  });

  test("a start is asked once, and a failure says why and allows another", () => {
    const starting = matchEndReducer(READY, { type: "start-requested" });
    expect(matchEndReducer(starting, { type: "start-requested" })).toBe(starting);
    const failed = matchEndReducer(starting, { type: "start-failed", text: "Nada mudou." });
    expect(failed).toMatchObject({ starting: false, failure: "Nada mudou." });
  });
});
