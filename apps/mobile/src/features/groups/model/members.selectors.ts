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

/** The tab asked for, or the first one when it does not exist for this role (the invites, demoted). */
export function shownTabOf(tabs: readonly MembersTab[], wanted: MembersTab): MembersTab {
  return tabs.includes(wanted) ? wanted : "regular";
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

const { positions, guestOrigin } = strings.ratings;
const INITIALS_LENGTH = 2;
const INITIAL_CHARACTER = /[\p{L}\p{N}]/gu;

/** The nickname (E3.17), or "Você" / "Membro desde 12 out" for who never saved a profile. */
export function memberName(member: Member): string {
  if (member.nickname !== null) return member.nickname;
  return member.isMe ? row.you : row.since(shortDay(member.joinedAt));
}

/** "JO" for João: the first two letters or digits; `null` (the neutral avatar) without a nickname. */
export function initialsOf(member: Member): string | null {
  if (member.nickname === null) return null;
  const letters = member.nickname.match(INITIAL_CHARACTER) ?? [];
  const initials = letters.slice(0, INITIALS_LENGTH).join("").toLocaleUpperCase("pt-BR");
  return initials === "" ? null : initials;
}

/** "Ponteiro · líbero": the main position first, the others in lower case, as the API orders them. */
export function positionsText(member: Member): readonly string[] {
  if (member.primaryPosition === null) return [];
  const others = member.otherPositions.map((position) =>
    positions[position].toLocaleLowerCase("pt-BR"),
  );
  return [positions[member.primaryPosition], ...others];
}

function typeText(member: Member, afterPositions: boolean): string {
  const type = member.memberType === "regular" ? row.regular : row.dropIn;
  return afterPositions ? type.toLocaleLowerCase("pt-BR") : type;
}

/** "Ponteiro · mensalista · você", "Ponteira · líbero · mensalista", "Avulso · entrou pelo WhatsApp". */
export function memberDetail(member: Member): string {
  const shown = positionsText(member);
  return [
    ...shown,
    typeText(member, shown.length > 0),
    ...(member.isMe ? [row.youSuffix] : []),
    ...(member.hasAccount ? [] : [guestOrigin]),
  ].join(row.separator);
}

export interface MemberRowModel {
  readonly memberId: string;
  /** The nickname, or "Você" / "Membro desde 12 out" for who never saved a profile. */
  readonly title: string;
  /** `null`: the neutral avatar with the person icon. */
  readonly initials: string | null;
  readonly badgeLabel: string;
  readonly badgeLook: BadgeLook;
  /** "Ponteiro · mensalista · você". */
  readonly detail: string;
  /** A guest without an account has the dashed avatar. */
  readonly dashedAvatar: boolean;
  readonly optionsLabel: string;
}

export function memberRowModel(member: Member): MemberRowModel {
  const title = memberName(member);
  return {
    memberId: member.memberId,
    title,
    initials: initialsOf(member),
    badgeLabel: member.hasAccount ? roleLabel(member.role) : row.noAccount,
    badgeLook: member.hasAccount ? member.role : "noAccount",
    detail: memberDetail(member),
    dashedAvatar: !member.hasAccount,
    optionsLabel:
      member.isMe && member.nickname === null
        ? row.yourOptions
        : row.options(member.nickname ?? title.toLowerCase()),
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
