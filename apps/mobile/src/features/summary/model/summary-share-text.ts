import { summaryStrings } from "../../../strings/summary.pt-BR";
import type { HighlightView, ReadySummary } from "./summary-view";

const { share } = summaryStrings;

function highlightSentence(
  highlight: HighlightView | null,
  sentence: (label: string, figure: string) => string,
): readonly string[] {
  return highlight === null ? [] : [sentence(highlight.label, highlight.figure)];
}

/**
 * The text "Mandar pro grupo" hands to the share sheet: the numbers of screen 12, as the screen shows them.
 * Plain text with no link, no rating and no note; a card that is hidden stays out of the text too.
 * Names are nicknames already in the group.
 */
export function summaryShareText(ready: ReadySummary): string {
  const { mvp, highlights } = ready;
  return [
    share.intro(ready.header),
    ...(mvp === null ? [] : [share.mvp(mvp.name, mvp.detail)]),
    ...highlightSentence(highlights.mostWins, share.mostWins),
    ...highlightSentence(highlights.longestStreak, share.longestStreak),
  ].join(" ");
}
