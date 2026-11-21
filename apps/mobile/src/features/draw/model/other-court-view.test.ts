import { describe, expect, test } from "vitest";

import type { RoundEnd } from "../../court/ports/round-end-lookup";
import type { OtherRoundCourt } from "../../court/session/other-round-court";
import { closeOtherBody } from "./close-other-text";
import { otherCourtView } from "./other-court-view";
import { initialDrawFlowState } from "./draw-flow.reducer";
import { preGameReducer } from "./pre-game.reducer";
import { canStart, startBlocker } from "./pre-game-selectors";
import { startBlockerText } from "./pre-game-texts";

const ENDS_AT = Date.parse("2026-11-19T23:00:00Z");
const LISTED: RoundEnd = {
  kind: "listed",
  endsAt: ENDS_AT,
  localDate: "2026-11-19",
  canceled: false,
};
const OTHER: OtherRoundCourt = {
  courtSessionId: "old",
  origin: { groupId: "g1", roundId: "r-old" },
  openedAt: null,
  ownership: "own",
};

describe("otherCourtView: what the 08 does with a match of another round (R97, D2, D5)", () => {
  test("no other match, no notice", () => {
    expect(otherCourtView(null, LISTED, ENDS_AT)).toEqual({ kind: "none" });
  });

  test("its round still on: the link, never the sheet (D2)", () => {
    expect(otherCourtView(OTHER, LISTED, ENDS_AT - 1)).toEqual({
      kind: "open",
      courtSessionId: "old",
    });
  });

  test("its round not known (offline, no cache): the link, never closed here", () => {
    expect(otherCourtView(OTHER, { kind: "unknown" }, ENDS_AT)).toEqual({
      kind: "open",
      courtSessionId: "old",
    });
  });

  test("its round ended, this account's: forgotten, from the exact end on", () => {
    expect(otherCourtView(OTHER, LISTED, ENDS_AT)).toEqual({
      kind: "forgotten",
      courtSessionId: "old",
      localDate: "2026-11-19",
    });
    expect(otherCourtView(OTHER, { kind: "gone" }, ENDS_AT)).toEqual({
      kind: "forgotten",
      courtSessionId: "old",
      localDate: null,
    });
  });

  test("its round ended, another account's: nothing may end it here", () => {
    const foreign: OtherRoundCourt = { ...OTHER, ownership: "other-account" };
    expect(otherCourtView(foreign, LISTED, ENDS_AT)).toEqual({ kind: "other-account" });
    const unowned: OtherRoundCourt = { ...OTHER, ownership: "unowned" };
    expect(otherCourtView(unowned, LISTED, ENDS_AT).kind).toBe("other-account");
  });

  test("a sample session is always the link", () => {
    const sample: OtherRoundCourt = { ...OTHER, origin: null };
    expect(otherCourtView(sample, { kind: "gone" }, ENDS_AT).kind).toBe("open");
  });
});

describe("the start of the 08 with another round's match (R97, D2, D5)", () => {
  test("an open one blocks before the tap, with its own text", () => {
    const open = otherCourtView(OTHER, LISTED, ENDS_AT - 1);
    expect(startBlocker(0, null, open)).toBe("other-round-open");
    expect(canStart(0, null, open)).toBe(false);
    expect(startBlockerText("other-round-open")).toBe(
      "Há uma partida aberta em outra rodada. Abra e encerre pelo Menu antes de começar esta.",
    );
  });

  test("a forgotten one does not block: the start asks first", () => {
    expect(canStart(0, null, otherCourtView(OTHER, LISTED, ENDS_AT))).toBe(true);
  });

  test("another account's one blocks", () => {
    const foreign = otherCourtView({ ...OTHER, ownership: "other-account" }, LISTED, ENDS_AT);
    expect(startBlocker(0, null, foreign)).toBe("other-round-other-account");
  });

  test("the list that changed still comes first", () => {
    expect(startBlocker(1, null, otherCourtView(OTHER, LISTED, ENDS_AT - 1))).toBe("stale");
  });

  test("the sheet names the round by its date, or says it ended", () => {
    expect(closeOtherBody(otherCourtView(OTHER, LISTED, ENDS_AT))).toBe(
      "Há uma partida aberta da rodada de qui, 19/11. Encerrar a antiga e começar esta?",
    );
    expect(closeOtherBody(otherCourtView(OTHER, { kind: "gone" }, ENDS_AT))).toBe(
      "Há uma partida aberta de uma rodada que já terminou. Encerrar a antiga e começar esta?",
    );
  });
});

describe("the sheet 'Encerrar a partida antiga?' in the flow (R97, D5)", () => {
  const onPreGame = { ...initialDrawFlowState, sheet: "pre-game" as const };

  test("opens only over the 08 and goes back to it", () => {
    const asked = preGameReducer(onPreGame, { type: "close-other-asked" });
    expect(asked.sheet).toBe("close-other");
    expect(preGameReducer(asked, { type: "close-other-dismissed" }).sheet).toBe("pre-game");
  });

  test("cancelling changes nothing else, and outside the 08 nothing opens", () => {
    const asked = preGameReducer(onPreGame, { type: "close-other-asked" });
    expect(preGameReducer(asked, { type: "close-other-dismissed" })).toEqual(onPreGame);
    expect(preGameReducer(initialDrawFlowState, { type: "close-other-asked" })).toBe(
      initialDrawFlowState,
    );
  });
});
