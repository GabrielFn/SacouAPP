import type { Member, MvpBallot, MvpCandidate } from "../../../../services/api/sacou-api";
import { member } from "../../../groups/model/members.test.fixture";

export const ROUND = "8a4c2f0e-5555-4c3b-9d2e-000000000005";
export const OPENS_AT = "2026-11-20T02:30:00.000Z";
/** 23 h 59 min after `NOW`. */
export const CLOSES_AT = "2026-11-21T02:29:00.000Z";
export const NOW = Date.parse("2026-11-20T02:30:00.000Z");

interface CanvasCandidate {
  readonly memberId: string;
  readonly nickname: string;
  readonly mainSide: "a" | "b";
  readonly matchesPlayed: number;
  readonly plusMinus: number;
}

/** The ballot of the canvas (VotarMvp.dc.html), in a shuffled order: the app orders it (question 177). */
const CANVAS: readonly CanvasCandidate[] = [
  { memberId: "m-lia", nickname: "Lia", mainSide: "b", matchesPlayed: 4, plusMinus: -2 },
  { memberId: "m-leo", nickname: "Léo", mainSide: "b", matchesPlayed: 2, plusMinus: -8 },
  { memberId: "m-bia", nickname: "Bia", mainSide: "a", matchesPlayed: 5, plusMinus: 34 },
  { memberId: "m-nina", nickname: "Nina", mainSide: "b", matchesPlayed: 3, plusMinus: -11 },
  { memberId: "m-caio", nickname: "Caio", mainSide: "b", matchesPlayed: 4, plusMinus: 6 },
  { memberId: "m-gabi", nickname: "Gabi", mainSide: "a", matchesPlayed: 5, plusMinus: 21 },
  { memberId: "m-marcos", nickname: "Marcos", mainSide: "a", matchesPlayed: 3, plusMinus: 9 },
];

export const CANDIDATES: MvpCandidate[] = CANVAS.map(
  ({ memberId, mainSide, matchesPlayed, plusMinus }) => ({
    memberId,
    matchesPlayed,
    plusMinus,
    wins: 0,
    mainSide,
  }),
);

export const MEMBERS: readonly Member[] = [
  ...CANVAS.map(({ memberId, nickname }) => member(memberId, "player", { nickname })),
  member("m-me", "player", { nickname: "Eu", isMe: true }),
];

export function ballot(overrides: Partial<MvpBallot> = {}): MvpBallot {
  return {
    state: "open",
    opensAt: OPENS_AT,
    closesAt: CLOSES_AT,
    canVote: true,
    reason: null,
    myVote: null,
    candidates: CANDIDATES,
    ...overrides,
  };
}

/** The scenarios of the fake (plan, step 1): one answer of `getMvpVoting` each. */
export const SCENARIOS = {
  open: ballot(),
  notOpen: ballot({ state: "notOpen", canVote: false, reason: "notOpen", candidates: [] }),
  closed: ballot({ state: "closed", canVote: false, reason: "closed" }),
  voted: ballot({
    canVote: false,
    reason: "alreadyVoted",
    myVote: { candidateMemberId: "m-bia", castAt: "2026-11-20T03:00:00.000Z" },
  }),
  notPlayed: ballot({ canVote: false, reason: "notPlayed" }),
} as const;
