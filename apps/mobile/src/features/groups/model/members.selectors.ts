import type { GroupRole, Invite, Member } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { organizes, roleLabel } from "./groups-list.selectors";

const { row, tabs, months } = strings.members;

export type MembersTab = "regular" | "dropIn" | "invites";

/** You first, then Admin, Co-admin, Placar and Jogador, then who joined first (E4.5, D6). */
const ROLE_ORDER: Readonly<Record<GroupRole, number>> = {
  admin: 0,
  coAdmin: 1,
  scorekeeper: 2,
  player: 3,
};

export function sortMembers(members: readonly Member[]): readonly Member[] {
  return [...members].sort(
    (first, second) =>
      Number(second.isMe) - Number(first.isMe) ||
      ROLE_ORDER[first.role] - ROLE_ORDER[second.role] ||
      first.joinedAt.localeCompare(second.joinedAt),
  );
}

/** The invites tab exists only for who may manage invites; for the others it is never asked. */
export function canManageInvites(role: GroupRole): boolean {
  return organizes(role);
}

export function membersTabs(role: GroupRole): readonly MembersTab[] {
  return canManageInvites(role) ? ["regular", "dropIn", "invites"] : ["regular", "dropIn"];
}

export function membersOfTab(members: readonly Member[], tab: MembersTab): readonly Member[] {
  if (tab === "invites") return [];
  return sortMembers(members.filter((member) => member.memberType === tab));
}

export function tabLabel(tab: MembersTab, members: readonly Member[]): string {
  const count = (type: Member["memberType"]) =>
    members.filter((member) => member.memberType === type).length;
  switch (tab) {
    case "regular":
      return tabs.regular(count("regular"));
    case "dropIn":
      return tabs.dropIn(count("dropIn"));
    case "invites":
      return tabs.invites;
  }
}

export function membersHeader(groupName: string, role: GroupRole): string {
  return strings.members.header(groupName, strings.members.roleInHeader[role]);
}

/** "12 out", in the phone's time zone. */
export function shortDay(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return `${String(date.getDate())} ${months[date.getMonth()] ?? ""}`;
}

export type BadgeLook = GroupRole | "noAccount";

export interface MemberRowModel {
  readonly memberId: string;
  /** "Você", or "Membro desde 12 out" until the names arrive (E3.17, question 30). */
  readonly title: string;
  readonly badgeLabel: string;
  readonly badgeLook: BadgeLook;
  /** "Mensalista · você", "Avulso". */
  readonly detail: string;
  /** A guest without an account has the dashed avatar. */
  readonly dashedAvatar: boolean;
  readonly optionsLabel: string;
}

export function memberRowModel(member: Member): MemberRowModel {
  const title = member.isMe ? row.you : row.since(shortDay(member.joinedAt));
  const type = member.memberType === "regular" ? row.regular : row.dropIn;
  return {
    memberId: member.memberId,
    title,
    badgeLabel: member.hasAccount ? roleLabel(member.role) : row.noAccount,
    badgeLook: member.hasAccount ? member.role : "noAccount",
    detail: member.isMe ? [type, row.youSuffix].join(row.separator) : type,
    dashedAvatar: !member.hasAccount,
    optionsLabel: member.isMe ? row.yourOptions : row.options(title.toLowerCase()),
  };
}

export interface InviteRowModel {
  readonly inviteId: string;
  readonly text: string;
  readonly revokeLabel: string;
}

/** The newest first. Only valid invites come from the API; no token is ever in the list. */
export function inviteRows(invites: readonly Invite[]): readonly InviteRowModel[] {
  return [...invites]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .map((invite) => {
      const day = shortDay(invite.createdAt);
      return {
        inviteId: invite.inviteId,
        text: strings.members.invites.created(day, invite.useCount),
        revokeLabel: strings.members.invites.revokeLabel(day),
      };
    });
}
