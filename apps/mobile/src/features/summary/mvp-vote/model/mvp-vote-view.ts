import { apiErrorOf, type ApiError } from "../../../../services/api/api-error";
import { apiErrorText, errorTextOf } from "../../../../services/api/api-error-text";
import type { Member, MvpBallot } from "../../../../services/api/sacou-api";
import { mvpVoteStrings as texts } from "../../../../strings/mvp-vote.pt-BR";
import { initialsOfName } from "../../../../ui/initials";
import { orderBallot } from "./ballot-order";
import { candidateLine } from "./candidate-line";
import { canSubmit, type MvpVoteState } from "./mvp-vote.reducer";
import { localTimeText, remainingText } from "./voting-deadline";

/** What the ballot query says, as the screen needs it (only the part that decides the state). */
export interface MvpBallotQueryState {
  readonly status: "pending" | "error" | "success";
  readonly data: MvpBallot | undefined;
  readonly error: unknown;
}

export interface MvpVoteViewInput {
  readonly query: MvpBallotQueryState;
  readonly members: readonly Member[] | undefined;
  readonly online: boolean;
  /** The wall clock of the phone, for "fecha em 23 h" only: the server decides the window. */
  readonly nowMs: number;
  readonly vote: MvpVoteState;
}

export interface BallotRowView {
  readonly memberId: string;
  readonly name: string;
  readonly initials: string | null;
  /** "Laranja · 5 partidas · +34". */
  readonly line: string;
  readonly selected: boolean;
}

export interface ChoosingView {
  readonly kind: "choosing";
  /** "Voto secreto · fecha em 23 h". */
  readonly deadline: string;
  readonly rows: readonly BallotRowView[];
  /** "Votar em Bia", "Escolha quem foi o MVP" or "Conecte-se para votar". */
  readonly footerLabel: string;
  readonly canSubmit: boolean;
  readonly submitting: boolean;
  /** The last refusal, in words that never name the candidate (plan, section 4, item 6). */
  readonly errorText: string | null;
}

export type MvpVoteBody =
  | { readonly kind: "loading" }
  | { readonly kind: "offline-empty" }
  | { readonly kind: "error"; readonly text: string }
  | { readonly kind: "voting-off" }
  | { readonly kind: "not-open"; readonly opensAt: string }
  | { readonly kind: "not-eligible"; readonly closesIn: string }
  | { readonly kind: "already-voted"; readonly voted: string; readonly result: string }
  | { readonly kind: "closed" }
  | ChoosingView;

export type MvpVoteKind = MvpVoteBody["kind"];

export interface MvpVoteView {
  readonly body: MvpVoteBody;
  /** The last ballot seen, shown because a new one could not be read (the vote waits for a network). */
  readonly stale: boolean;
}

const VOTING_OFF = "stats.mvp-voting-off";

function nameOf(memberId: string, members: readonly Member[] | undefined): string {
  const nickname = members?.find((member) => member.memberId === memberId)?.nickname ?? null;
  return nickname === null || nickname.trim() === "" ? texts.noName : nickname;
}

function failureText(error: ApiError): string {
  return error.kind === "offline" ? texts.offlineFailure : apiErrorText(error);
}

function withoutData({ query, online }: MvpVoteViewInput): MvpVoteBody {
  if (query.status !== "error") return online ? { kind: "loading" } : { kind: "offline-empty" };
  const error = apiErrorOf(query.error);
  if (error?.kind === "problem" && error.code === VOTING_OFF) return { kind: "voting-off" };
  if (error?.kind === "offline") return { kind: "offline-empty" };
  return { kind: "error", text: errorTextOf(query.error) };
}

function footerLabelOf(selectedName: string | null, online: boolean): string {
  if (!online) return texts.connectToVote;
  return selectedName === null ? texts.chooseFirst : texts.voteFor(selectedName);
}

function choosing(ballot: MvpBallot, input: MvpVoteViewInput): ChoosingView {
  const { members, online, nowMs, vote } = input;
  const rows = orderBallot(ballot.candidates).map((candidate) => {
    const name = nameOf(candidate.memberId, members);
    return {
      memberId: candidate.memberId,
      name,
      initials: initialsOfName(name),
      line: candidateLine(candidate),
      selected: candidate.memberId === vote.selected,
    };
  });
  // A choice that left the ballot (the server refused the candidate and the ballot came again) is no choice.
  const selected = rows.find((row) => row.selected) ?? null;
  return {
    kind: "choosing",
    deadline: texts.secretUntil(remainingText(Date.parse(ballot.closesAt), nowMs)),
    rows,
    footerLabel: footerLabelOf(selected?.name ?? null, online),
    canSubmit: selected !== null && canSubmit(vote, online),
    submitting: vote.phase === "submitting",
    errorText: vote.error === null ? null : failureText(vote.error),
  };
}

function withBallot(ballot: MvpBallot, input: MvpVoteViewInput): MvpVoteBody {
  const closesIn = remainingText(Date.parse(ballot.closesAt), input.nowMs);
  // The server's own vote wins over anything chosen here (D2): the cache is the one record of it.
  if (ballot.myVote !== null || ballot.reason === "alreadyVoted") {
    const voted =
      ballot.myVote === null
        ? texts.votedSecret
        : texts.votedFor(nameOf(ballot.myVote.candidateMemberId, input.members));
    return { kind: "already-voted", voted, result: texts.resultWhenClosed(closesIn) };
  }
  switch (ballot.state) {
    case "notOpen":
      return { kind: "not-open", opensAt: texts.opensAt(localTimeText(new Date(ballot.opensAt))) };
    case "closed":
      return { kind: "closed" };
    case "open":
      return ballot.canVote ? choosing(ballot, input) : { kind: "not-eligible", closesIn };
  }
}

/** The whole state of screen 12a, derived on each render from the cache and the reducer (rule 1). */
export function mvpVoteView(input: MvpVoteViewInput): MvpVoteView {
  const ballot = input.query.data;
  if (ballot === undefined) return { body: withoutData(input), stale: false };
  return {
    body: withBallot(ballot, input),
    stale: input.query.status === "error" || !input.online,
  };
}
