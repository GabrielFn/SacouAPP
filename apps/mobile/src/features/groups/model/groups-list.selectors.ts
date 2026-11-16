import type { GroupRole, MyGroup } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import type { PendingGroupScreen } from "../navigation";

const { summary, roles, card } = strings.groups;

/** Who runs the group: the roles that manage settings and invites (E4.4, D2). */
export function organizes(role: GroupRole): boolean {
  return role === "admin" || role === "coAdmin";
}

export function roleLabel(role: GroupRole): string {
  switch (role) {
    case "admin":
      return roles.admin;
    case "coAdmin":
      return roles.coAdmin;
    case "scorekeeper":
      return roles.scorekeeper;
    case "player":
      return roles.player;
  }
}

/** "4 grupos. Você organiza um, joga nos outros.", or `null` with no group (the empty state speaks). */
export function groupsSummaryText(groups: readonly MyGroup[]): string | null {
  const total = groups.length;
  const organized = groups.filter((group) => organizes(group.role)).length;
  const played = total - organized;
  if (total === 0) return null;
  if (total === 1) return organized === 1 ? summary.oneOrganized : summary.onePlays;
  if (played === 0) return summary.allOrganized(total);
  if (organized === 0) return summary.allPlayed(total);
  if (organized === 1) {
    return played === 1 ? summary.oneOrganizedOnePlayed : summary.oneOrganizedManyPlayed(total);
  }
  return summary.manyOrganized(total, organized);
}

export interface GroupCardModel {
  readonly groupId: string;
  readonly name: string;
  readonly role: GroupRole;
  readonly roleLabel: string;
  /** Rounds come with E3.4; until then every group reads the same. */
  readonly nextRoundText: string;
}

export function groupCardModel(group: MyGroup): GroupCardModel {
  return {
    groupId: group.groupId,
    name: group.name,
    role: group.role,
    roleLabel: roleLabel(group.role),
    nextRoundText: card.noRound,
  };
}

export type GroupCardAction = "members" | "settings" | "editRound";

const ACTION_SCREEN: Readonly<Record<"members" | "settings", PendingGroupScreen>> = {
  members: "members",
  settings: "settings",
};

/**
 * The footer links of a card: only for who organizes (the roles with ManageRounds), only when the
 * destination exists, and "Editar rodada" only when the group has a next round to edit.
 */
export function groupCardActions(
  role: GroupRole,
  pending: readonly PendingGroupScreen[],
  hasNextRound = false,
): readonly GroupCardAction[] {
  if (!organizes(role)) return [];
  const screens = (["members", "settings"] as const).filter(
    (action) => !pending.includes(ACTION_SCREEN[action]),
  );
  return hasNextRound ? [...screens, "editRound"] : screens;
}
