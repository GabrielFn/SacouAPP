import type { GroupRole, Member } from "../../../services/api/sacou-api";

export const ROLES: readonly GroupRole[] = ["admin", "coAdmin", "scorekeeper", "player"];

/** A chip of the role: the current one is marked; a role who acts cannot give is off, not hidden. */
export type ChipState = "current" | "enabled" | "disabled";

export interface RoleChip {
  readonly role: GroupRole;
  readonly state: ChipState;
}

export interface TypeChoice {
  /** "Mensalista" is off with "Precisa ter conta" for a guest without an account. */
  readonly regularBlocked: boolean;
}

/** What the sheet 19c offers for one row (E4.5, D6; the table of answer 16 in `grupos.md`). */
export interface MemberSheet {
  readonly target: Member;
  /** `null`: the section is not shown (a scorekeeper or a player on its own row). */
  readonly roles: readonly RoleChip[] | null;
  readonly type: TypeChoice | null;
  /** Own row: "Sair do grupo". */
  readonly canLeave: boolean;
  /** Another row: "Remover do grupo" (question 30, closed with the names of E3.17). */
  readonly canRemove: boolean;
  /** Another row, for every role: "Denunciar" (E6.6, question 232). Never on the own row. */
  readonly canReport: boolean;
  /** "Nota do sorteio": admins and co-admins only, on every row, their own included (ADR 0047). */
  readonly showsLevel: boolean;
  /** The only admin: leaving and demoting itself are off, with "Promova outro admin antes". */
  readonly lastAdmin: boolean;
}

const isAdminRole = (role: GroupRole) => role === "admin" || role === "coAdmin";

function chips(current: GroupRole, allowed: (role: GroupRole) => boolean): readonly RoleChip[] {
  return ROLES.map((role) => ({
    role,
    state: role === current ? "current" : allowed(role) ? "enabled" : "disabled",
  }));
}

/** Whom an admin or co-admin may give each role to, for another person. */
function allowedForOther(me: GroupRole, target: GroupRole): (role: GroupRole) => boolean {
  if (me === "admin") return () => true;
  // A co-admin moves only between Placar and Jogador, and never touches an admin or a co-admin.
  return (role) => !isAdminRole(target) && !isAdminRole(role);
}

function ownSheet(me: Member, members: readonly Member[]): MemberSheet {
  const admins = members.filter((member) => member.role === "admin").length;
  const lastAdmin = me.role === "admin" && admins <= 1;
  if (!isAdminRole(me.role)) {
    return {
      target: me,
      roles: null,
      type: null,
      canLeave: true,
      canRemove: false,
      canReport: false,
      showsLevel: false,
      lastAdmin,
    };
  }
  // An admin demotes itself only with another admin; a co-admin never does (it leaves).
  const roles = chips(me.role, () => me.role === "admin" && !lastAdmin);
  return {
    target: me,
    roles,
    type: { regularBlocked: !me.hasAccount },
    canLeave: true,
    canRemove: false,
    canReport: false,
    showsLevel: true,
    lastAdmin,
  };
}

/** Placar and Jogador on someone else's row: only "Denunciar" (E6.6). */
function reportOnlySheet(target: Member): MemberSheet {
  return {
    target,
    roles: null,
    type: null,
    canLeave: false,
    canRemove: false,
    canReport: true,
    showsLevel: false,
    lastAdmin: false,
  };
}

/** The sheet of a row: every row has a "⋯", since anyone may report someone else (E6.6). */
export function memberActions(me: Member, target: Member, members: readonly Member[]): MemberSheet {
  if (target.memberId === me.memberId) return ownSheet(me, members);
  if (!isAdminRole(me.role)) return reportOnlySheet(target);
  const allowed = allowedForOther(me.role, target.role);
  // A guest without an account is always Jogador (`groups.role-needs-account`).
  return {
    target,
    roles: chips(target.role, (role) => allowed(role) && (target.hasAccount || role === "player")),
    type: { regularBlocked: !target.hasAccount },
    canLeave: false,
    // A co-admin removes only Placar and Jogador (`RemoveMember`); an admin removes anyone (`RemoveAdmin`).
    canRemove: me.role === "admin" || !isAdminRole(target.role),
    canReport: true,
    showsLevel: true,
    lastAdmin: false,
  };
}

/** Who becomes Placar or Jogador loses its invites on the server; the phone forgets its copy. */
export function losesInvites(role: GroupRole): boolean {
  return !isAdminRole(role);
}

/** Admins and co-admins see and give the levels (`ManageMemberLevels`); the others never ask (ADR 0047). */
export function canManageLevels(role: GroupRole): boolean {
  return isAdminRole(role);
}
