import { errorTextOf } from "../../../services/api/api-error-text";
import { apiErrorOf } from "../../../services/api/api-error";
import type { Member, MvpBallot, RoundSummaryReport } from "../../../services/api/sacou-api";
import { summaryStrings } from "../../../strings/summary.pt-BR";
import type { TeamColor } from "../../draw/model/team-identity";
import { rankingHighlights, sandTeamKind, type RankingHighlights } from "./beach-ranking-view";
import { mvpHeroText } from "./mvp-hero-text";
import { headerLine, sideLook, type SummarySide } from "./summary-texts";
import { votingEntryView, type VotingEntryView } from "./voting-entry";

/** What the query says, as the screen needs it (only the part that decides the state). */
export interface SummaryQueryState {
  readonly status: "pending" | "error" | "success";
  readonly data: RoundSummaryReport | undefined;
  readonly error: unknown;
}

export interface SummaryViewInput {
  readonly query: SummaryQueryState;
  readonly groupName: string | null;
  readonly members: readonly Member[] | undefined;
  readonly online: boolean;
  /** Points of this round this phone still has to send; the screen warns the summary may change. */
  readonly unsentPoints: number;
  /** The MVP ballot, read only while the voting is open (the entry to the vote). */
  readonly ballot: MvpBallot | undefined;
  /** The wall clock of the phone, for "fecha em 23 h" only. */
  readonly nowMs: number;
}

export interface MvpView {
  readonly name: string;
  /** "Laranja · +2 de saldo · 2 vitórias em 3"; `null` for a tie of votes (no single set of numbers). */
  readonly line: string | null;
  /** "+2 de saldo, 2 vitórias em 3": the shared text uses it, without the side. */
  readonly detail: string | null;
  readonly source: "stats" | "votes";
  /** The lines of small print under the card, already in words. */
  readonly notes: readonly string[];
}

export interface HighlightView {
  readonly title: string;
  readonly label: string;
  readonly figure: string;
  readonly color: TeamColor;
}

export interface TeamsHighlights {
  readonly kind: "teams";
  readonly mostWins: HighlightView | null;
  readonly longestStreak: HighlightView | null;
}

export interface ReadySummary {
  readonly kind: "ready";
  readonly header: string;
  readonly mvp: MvpView | null;
  readonly highlights: TeamsHighlights | RankingHighlights;
  readonly voting: VotingEntryView;
  /** The last summary seen, shown because the new one could not be read. */
  readonly stale: boolean;
  readonly unsentNote: string | null;
}

export type SummaryView =
  | { readonly kind: "loading" }
  | { readonly kind: "offline-empty" }
  | { readonly kind: "error"; readonly text: string }
  /** The server has no finished match; with points still on this phone, the note says why (E4.12). */
  | { readonly kind: "empty"; readonly header: string; readonly unsentNote: string | null }
  | ReadySummary;

/** The nickname of a member of the cache, or "Jogador" (screens 12 and 12a). */
export function nameOf(memberId: string, members: readonly Member[] | undefined): string {
  const nickname = members?.find((member) => member.memberId === memberId)?.nickname ?? null;
  return nickname === null || nickname.trim() === "" ? summaryStrings.noName : nickname;
}

function mvpNotes(source: MvpView["source"], votingOpen: boolean): readonly string[] {
  return [
    source === "votes" ? summaryStrings.mvpByVotesNote : summaryStrings.mvpNote,
    ...(votingOpen && source === "stats" ? [summaryStrings.votingOpenNote] : []),
  ];
}

/** A player, a tie of players (votes) or a team of the sand; `null` when the server sent none. */
function mvpViewOf(
  report: RoundSummaryReport,
  members: readonly Member[] | undefined,
): MvpView | null {
  const { mvp } = report;
  if (mvp === null || mvp.memberIds.length === 0) return null;
  const source = mvp.source;
  return {
    name: summaryStrings.names(mvp.memberIds.map((memberId) => nameOf(memberId, members))),
    ...mvpHeroText(mvp),
    source,
    notes: mvpNotes(source, report.mvpVoting?.state === "open"),
  };
}

function highlight(title: string, side: SummarySide, figure: string): HighlightView {
  const look = sideLook(side);
  return { title, label: look.label, figure, color: look.color };
}

function teamsOf({ sides }: RoundSummaryReport): TeamsHighlights {
  return {
    kind: "teams",
    mostWins:
      sides.mostWins === null
        ? null
        : highlight(
            summaryStrings.mostWinsTitle,
            sides.mostWins.side,
            summaryStrings.wins(sides.mostWins.wins),
          ),
    longestStreak:
      sides.longestStreak === null
        ? null
        : highlight(
            summaryStrings.longestStreakTitle,
            sides.longestStreak.side,
            summaryStrings.streak(sides.longestStreak.longestWinStreak),
          ),
  };
}

function highlightsOf(
  report: RoundSummaryReport,
  members: readonly Member[] | undefined,
): TeamsHighlights | RankingHighlights {
  return sandTeamKind(report.modality) === null
    ? teamsOf(report)
    : rankingHighlights(report.ranking, members, nameOf);
}

function withoutData(input: SummaryViewInput): SummaryView {
  const { query, online } = input;
  if (query.status === "error") {
    return apiErrorOf(query.error)?.kind === "offline"
      ? { kind: "offline-empty" }
      : { kind: "error", text: errorTextOf(query.error) };
  }
  return online ? { kind: "loading" } : { kind: "offline-empty" };
}

/** The whole state of screen 12, derived on each render from the cache and never stored (rule 1). */
export function summaryView(input: SummaryViewInput): SummaryView {
  const { query, groupName, members, unsentPoints } = input;
  const report = query.data;
  if (report === undefined) return withoutData(input);
  const header = headerLine(groupName, report.finishedMatches, sandTeamKind(report.modality));
  const unsentNote = unsentPoints > 0 ? summaryStrings.unsent(unsentPoints) : null;
  if (report.finishedMatches === 0) return { kind: "empty", header, unsentNote };
  return {
    kind: "ready",
    header,
    mvp: mvpViewOf(report, members),
    highlights: highlightsOf(report, members),
    voting: votingEntryView({ voting: report.mvpVoting, ballot: input.ballot, nowMs: input.nowMs }),
    stale: query.status === "error" || !input.online,
    unsentNote,
  };
}
