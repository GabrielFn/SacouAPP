import { summaryStrings } from "../../../strings/summary.pt-BR";
import { mvpDetail, mvpLine, type SummaryMvp } from "./summary-texts";

export interface MvpHeroText {
  /** The numbers under the name; `null` when they would belong to no single person (a tie of votes). */
  readonly line: string | null;
  /** The same numbers for the shared text; `null` when the text names the winner only. */
  readonly detail: string | null;
}

/**
 * The text of the MVP card: a player by the stats ("Laranja · +2 de saldo · 2 vitórias em 3"), a team
 * of the sand ("7 vitórias · ficaram 4 seguidas na quadra") or the winner of the votes (one winner keeps
 * the numbers; a tie shows names only). The count of votes is never in it.
 */
export function mvpHeroText(mvp: SummaryMvp): MvpHeroText {
  if (mvp.kind === "team") {
    return {
      line: summaryStrings.teamMvpLine(mvp.wins, mvp.longestWinStreak),
      detail: summaryStrings.wins(mvp.wins),
    };
  }
  if (mvp.source === "votes" && mvp.memberIds.length > 1) return { line: null, detail: null };
  return { line: mvpLine(mvp), detail: mvpDetail(mvp) };
}
