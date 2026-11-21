import type { MvpBallot, RoundSummaryReport } from "../../../services/api/sacou-api";
import { mvpVoteStrings as texts } from "../../../strings/mvp-vote.pt-BR";
import { remainingText } from "../mvp-vote/model/voting-deadline";

/** The entry to the vote on screen 12 (question 170): never the name voted, never a count. */
export type VotingEntryView =
  | { readonly kind: "hidden" }
  | { readonly kind: "not-open"; readonly text: string }
  | { readonly kind: "vote"; readonly label: string }
  | { readonly kind: "voted"; readonly text: string };

const HIDDEN: VotingEntryView = { kind: "hidden" };

export interface VotingEntryInput {
  readonly voting: RoundSummaryReport["mvpVoting"];
  /** The ballot, read only while the voting is open; `undefined` until it arrives or when it failed. */
  readonly ballot: MvpBallot | undefined;
  /** The wall clock of the phone, for "fecha em 23 h" only: the server decides the window. */
  readonly nowMs: number;
}

function openEntry({ voting, ballot, nowMs }: VotingEntryInput, closesAt: string): VotingEntryView {
  if (ballot === undefined || voting === null) return HIDDEN;
  const remaining = remainingText(Date.parse(closesAt), nowMs);
  if (ballot.myVote !== null || ballot.reason === "alreadyVoted") {
    return { kind: "voted", text: texts.entryVoted(remaining) };
  }
  return ballot.canVote ? { kind: "vote", label: texts.entryVote(remaining) } : HIDDEN;
}

/** Derived on each render from the summary and the ballot in the cache, never stored (rule 1). */
export function votingEntryView(input: VotingEntryInput): VotingEntryView {
  const { voting } = input;
  if (voting === null) return HIDDEN;
  switch (voting.state) {
    case "notOpen":
      return { kind: "not-open", text: texts.entryNotOpen };
    case "open":
      return openEntry(input, voting.closesAt);
    case "closed":
      return HIDDEN;
  }
}
