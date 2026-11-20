import type { MyStats } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { formatPercent } from "./player-card";

const { groupRow, formerGroup } = strings.profile.me;
const modalityTexts = strings.settings.choices["format.modality"];

export interface GroupStatsRowModel {
  readonly groupId: string;
  readonly name: string;
  /** "26 partidas · 65% (17 vitórias)". */
  readonly summary: string;
  /** "Quadra 6x6"; `null` when the server sent none or one this app does not know. */
  readonly modalityLabel: string | null;
}

/**
 * The rows of "Por grupo", in the order of the server (most matches first). A group without a match is
 * not listed. The group the person left has no name: it reads "Ex-jogador".
 */
export function groupRowsOf(report: MyStats): readonly GroupStatsRowModel[] {
  return report.groups
    .filter((group) => group.matchesPlayed > 0)
    .map((group) => ({
      groupId: group.groupId,
      name: group.groupName ?? formerGroup,
      summary: groupRow.summary(
        group.matchesPlayed,
        formatPercent(group.wins, group.matchesPlayed),
        group.wins,
      ),
      modalityLabel: group.modality === null ? null : (modalityTexts?.[group.modality] ?? null),
    }));
}
