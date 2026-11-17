import { displayNamesOf, type DisplayNames, type NamedMember } from "../../../ui/display-names";
import type { CourtScreenModel, QueueModel, TeamPanelModel } from "./court-screen.types";

type Teams = CourtScreenModel["teams"];

function membersOf(teams: Teams, queue: QueueModel | null): readonly NamedMember[] {
  const onCourt = [...teams.a.chips, ...teams.b.chips];
  const waiting =
    queue === null ? [] : [...queue.teams.flatMap(({ players }) => players), ...queue.players];
  return [...onCourt, ...waiting];
}

function namedChips(panel: TeamPanelModel, names: DisplayNames): TeamPanelModel {
  return {
    ...panel,
    chips: panel.chips.map((chip) => ({
      ...chip,
      displayName: names.get(chip.memberId) ?? chip.name,
    })),
  };
}

function namedQueue(queue: QueueModel, names: DisplayNames): QueueModel {
  const rename = <T extends { readonly memberId: string; readonly name: string }>(
    player: T,
  ): T => ({ ...player, displayName: names.get(player.memberId) ?? player.name });
  return {
    ...queue,
    teams: queue.teams.map((team) => ({ ...team, players: team.players.map(rename) })),
    players: queue.players.map(rename),
  };
}

/**
 * Gives each chip and each queue pill its display name. The twelve players and the queue are
 * compared together: two "Ana" anywhere on the screen become "Ana C." and "Ana B." (ADR 0052).
 */
export function withDisplayNames(
  teams: Teams,
  queue: QueueModel | null,
): { readonly teams: Teams; readonly queue: QueueModel | null } {
  const names = displayNamesOf(membersOf(teams, queue));
  return {
    teams: { a: namedChips(teams.a, names), b: namedChips(teams.b, names) },
    queue: queue === null ? null : namedQueue(queue, names),
  };
}
