import type { Member, RoundSummaryReport } from "../../../services/api/sacou-api";
import { summaryStrings } from "../../../strings/summary.pt-BR";

type Standing = NonNullable<RoundSummaryReport["ranking"]>[number];

const SAND_TEAM_KIND: Readonly<Record<string, string>> = {
  "beach-2x2": summaryStrings.sandTeamKind.pairs,
  "beach-4x4": summaryStrings.sandTeamKind.quartets,
};

/** "duplas" or "quartetos" for a modality of the sand; `null` for any other (screen 12 stays as it was). */
export function sandTeamKind(modality: string): string | null {
  return SAND_TEAM_KIND[modality] ?? null;
}

export interface RankingRowView {
  /** 1 to n: the server already broke the ties, so no position repeats. */
  readonly position: number;
  readonly key: string;
  /** "Bia e Gabi", "Bia, Gabi, Caio e Léo". */
  readonly name: string;
  /** "7 vitórias · 2 derrotas". */
  readonly record: string;
  readonly wins: number;
  readonly losses: number;
  readonly accessibilityLabel: string;
}

/** The ranking of the day of the sand (screen 12b): the order is the server's, the app only formats. */
export interface RankingHighlights {
  readonly kind: "ranking";
  readonly rows: readonly RankingRowView[];
}

function rowOf(
  standing: Standing,
  index: number,
  nameOf: (memberId: string) => string,
): RankingRowView {
  const position = index + 1;
  const name = summaryStrings.names(standing.memberIds.map(nameOf));
  const record = summaryStrings.record(standing.wins, standing.losses, standing.undecided);
  return {
    position,
    key: standing.memberIds.join("-"),
    name,
    record,
    wins: standing.wins,
    losses: standing.losses,
    accessibilityLabel: summaryStrings.rankingAccessibility(position, name, record),
  };
}

export function rankingHighlights(
  ranking: RoundSummaryReport["ranking"],
  members: readonly Member[] | undefined,
  nameOf: (memberId: string, members: readonly Member[] | undefined) => string,
): RankingHighlights {
  return {
    kind: "ranking",
    rows: (ranking ?? []).map((standing, index) =>
      rowOf(standing, index, (memberId) => nameOf(memberId, members)),
    ),
  };
}
