import { describe, expect, test } from "vitest";

import { attendanceRound, ME, memberOf } from "./attendance.test.fixture";
import { roundLinkOffer, roundShareText } from "./round-link-offer";
import { roundListText } from "./round-list-text";
import {
  initialRoundScreenState,
  roundScreenReducer,
  type RoundScreenState,
} from "./round-screen.reducer";

const URL = "https://sacou.example/r/K7fQ2xK7fQ2xK7fQ2xK7fQ";
const STARTS = Date.parse("2026-11-05T22:00:00Z");
const MINUTE = 60_000;
const withLink = attendanceRound({ shareUrl: URL });

describe("roundLinkOffer (R101 item 1)", () => {
  test("an open round with the link offers it", () => {
    expect(roundLinkOffer(withLink, STARTS - MINUTE)).toEqual({ kind: "share", url: URL });
  });

  test("the instant of the start already counts as started", () => {
    expect(roundLinkOffer(withLink, STARTS)).toEqual({ kind: "none" });
  });

  test("without the link, empty or missing, nothing is offered", () => {
    expect(roundLinkOffer(attendanceRound({ shareUrl: null }), STARTS - MINUTE).kind).toBe("none");
    expect(roundLinkOffer(attendanceRound({ shareUrl: "" }), STARTS - MINUTE).kind).toBe("none");
    expect(roundLinkOffer(attendanceRound(), STARTS - MINUTE).kind).toBe("none");
  });

  test("a canceled or closed round offers nothing", () => {
    expect(roundLinkOffer({ ...withLink, status: "canceled" }, STARTS - MINUTE).kind).toBe("none");
    const closed = { ...withLink, endsAt: "2026-11-05T10:00:00Z" };
    expect(roundLinkOffer(closed, STARTS - MINUTE).kind).toBe("none");
  });

  test("the share text is the one of screen 20, ending in the link", () => {
    expect(roundShareText("Racha", withLink, URL)).toBe(
      `Racha · Qui, 5/11 · 19h · Arena Beira-Mar · 12 vagas. Confirma aqui: ${URL}`,
    );
  });
});

describe("'Copiar lista' with and without the link (R101 item 1)", () => {
  const members = [memberOf(ME, "Eu")];
  const without = roundListText("Racha", withLink, members, false);

  test("without the link the text is the one of before", () => {
    expect(without).not.toContain("Confirma aqui");
    expect(roundListText("Racha", withLink, members, false, null)).toBe(without);
  });

  test("with the link, a blank line and 'Confirma aqui: <link>' close the text", () => {
    expect(roundListText("Racha", withLink, members, false, URL)).toBe(
      `${without}\n\nConfirma aqui: ${URL}`,
    );
  });
});

describe("the notes of screen 06 in the reducer (R101 item 1)", () => {
  test("copied with the link, then cleared", () => {
    const copied = roundScreenReducer(initialRoundScreenState, { type: "list-and-link-copied" });
    expect(copied.copyNote).toBe("copied-with-link");
    expect(roundScreenReducer(copied, { type: "copy-note-cleared" }).copyNote).toBe("none");
  });

  test("a failed share is its own note, apart from the copy note, and goes away", () => {
    const failed: RoundScreenState = roundScreenReducer(initialRoundScreenState, {
      type: "share-failed",
    });
    expect(failed).toEqual({ ...initialRoundScreenState, shareNote: "failed" });
    expect(roundScreenReducer(failed, { type: "share-note-cleared" }).shareNote).toBe("none");
  });
});
