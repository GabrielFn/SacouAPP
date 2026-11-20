import type { Member, MvpBallot, MvpCandidate } from "../../../../services/api/sacou-api";
import { member } from "../../../groups/model/members.test.fixture";

export const ROUND = "8a4c2f0e-5555-4c3b-9d2e-000000000005";
export const OPENS_AT = "2026-11-20T02:30:00.000Z";
/** 23 h 59 min after `NOW`. */
export const CLOSES_AT = "2026-11-21T02:29:00.000Z";
export const NOW = Date.parse("2026-11-20T02:30:00.000Z");

/** The ballot of the canvas (VotarMvp.dc.html), in a shuffled order: the app orders it (question 177). */
const CANVAS: readonly (readonly [string, string, "a" | "b", number, number])[] = [
  ["m-lia", "Lia", "b", 4, -2],
  ["m-leo", "Léo", "b", 2, -8],
  ["m-bia", "Bia", "a", 5, 34],
  ["m-nina", "Nina", "b", 3, -11],
  ["m-caio", "Caio", "b", 4, 6],
  ["m-gabi", "Gabi", "a", 5, 21],
  ["m-marcos", "Marcos", "a", 3, 9],
];

export const CANDIDATES: readonly MvpCandidate[] = CANVAS.map(
  ([memberId, , mainSide, matchesPlayed, plusMinus]) => ({
    memberId,
    matchesPlayed,
    plusMinus,
    wins: 0,
    mainSide,
  }),
);

export const MEMBERS: readonly Member[] = [
  ...CANVAS.map(([memberId, nickname]) => member(memberId, "player", { nickname })),
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
