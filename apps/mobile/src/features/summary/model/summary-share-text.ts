import { summaryStrings } from "../../../strings/summary.pt-BR";
import type { RankingHighlights } from "./beach-ranking-view";
import type { HighlightView, MvpView, ReadySummary } from "./summary-view";

const { share } = summaryStrings;

/** How many lines of the ranking of the sand go in the text: a long list does not fit a chat message. */
export const SHARE_RANKING_LINES = 5;

function highlightSentence(
  highlight: HighlightView | null,
  sentence: (label: string, figure: string) => string,
): readonly string[] {
  return highlight === null ? [] : [sentence(highlight.label, highlight.figure)];
}

function mvpSentence(mvp: MvpView | null): readonly string[] {
  if (mvp === null) return [];
  if (mvp.source === "votes") return [share.mvpByVotes(mvp.name)];
  return [mvp.detail === null ? share.mvpNoDetail(mvp.name) : share.mvp(mvp.name, mvp.detail)];
}

function rankingSentence({ rows }: RankingHighlights): readonly string[] {
  if (rows.length === 0) return [];
  const lines = rows
    .slice(0, SHARE_RANKING_LINES)
    .map((row) => share.rankingLine(row.position, row.name, row.wins, row.losses));
  return [share.ranking(lines)];
}

/**
 * The text "Mandar pro grupo" hands to the share sheet: the numbers of screen 12, as the screen shows them.
 * Plain text with no link, no rating and no note; a card that is hidden stays out of the text too.
 * Names are nicknames already in the group. Never the vote of the person, a count of votes or a deadline.
 */
export function summaryShareText(ready: ReadySummary): string {
  const { mvp, highlights } = ready;
  return [
    share.intro(ready.header),
    ...mvpSentence(mvp),
    ...(highlights.kind === "ranking"
      ? rankingSentence(highlights)
      : [
          ...highlightSentence(highlights.mostWins, share.mostWins),
          ...highlightSentence(highlights.longestStreak, share.longestStreak),
        ]),
  ].join(" ");
}
