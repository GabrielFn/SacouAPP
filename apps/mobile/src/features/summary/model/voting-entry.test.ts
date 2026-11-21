import { describe, expect, test } from "vitest";

import type { MvpBallot } from "../../../services/api/sacou-api";
import { votingEntryView, type VotingEntryInput } from "./voting-entry";

const OPENS = "2026-11-20T00:00:00Z";
const CLOSES = "2026-11-21T00:00:00Z";
const NOW = Date.parse(OPENS);
const MINUTE_MS = 60_000;
const MEMBER = "a0000000-0000-4000-8000-000000000001";

const ballot = (changes: Partial<MvpBallot>): MvpBallot => ({
  state: "open",
  opensAt: OPENS,
  closesAt: CLOSES,
  canVote: true,
  reason: null,
  myVote: null,
  candidates: [],
  ...changes,
});

const open = { state: "open", opensAt: OPENS, closesAt: CLOSES } as const;
const input = (changes: Partial<VotingEntryInput>): VotingEntryInput => ({
  voting: open,
  ballot: ballot({}),
  nowMs: NOW,
  ...changes,
});

describe("the entry to the vote on screen 12 (E1 to E7)", () => {
  test("E1: voting off, no entry", () => {
    expect(votingEntryView(input({ voting: null, ballot: undefined }))).toEqual({ kind: "hidden" });
  });

  test("E2: not open yet, a line and no button", () => {
    const voting = { ...open, state: "notOpen" } as const;
    expect(votingEntryView(input({ voting, ballot: undefined }))).toEqual({
      kind: "not-open",
      text: "A votação do MVP abre quando a rodada terminar",
    });
  });

  test("E3: open and the person can vote, the button says when it closes", () => {
    expect(votingEntryView(input({}))).toEqual({
      kind: "vote",
      label: "Votar no MVP · fecha em 24 h",
    });
    expect(votingEntryView(input({ nowMs: NOW + MINUTE_MS }))).toEqual({
      kind: "vote",
      label: "Votar no MVP · fecha em 23 h",
    });
  });

  test("E4: already voted, the line has no name", () => {
    const myVote = { candidateMemberId: MEMBER, castAt: OPENS };
    const entry = votingEntryView(input({ ballot: ballot({ myVote, canVote: false }) }));
    expect(entry).toEqual({ kind: "voted", text: "Você já votou · resultado em 24 h" });
    expect(JSON.stringify(entry)).not.toContain(MEMBER);
  });

  test("E5: not eligible, or the ballot not read yet, shows nothing", () => {
    const refused = ballot({ canVote: false, reason: "notPlayed" });
    expect(votingEntryView(input({ ballot: refused }))).toEqual({ kind: "hidden" });
    expect(votingEntryView(input({ ballot: undefined }))).toEqual({ kind: "hidden" });
  });

  test("E6: closed, no entry", () => {
    expect(votingEntryView(input({ voting: { ...open, state: "closed" } }))).toEqual({
      kind: "hidden",
    });
  });
});
