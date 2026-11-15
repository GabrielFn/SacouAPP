import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type {
  GroupRole,
  Member,
  MemberLevel,
  MemberType,
} from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { levelOf as wireLevel, type LevelTenths } from "../../../ui/skill-level";
import { canManageLevels, memberActions, type MemberSheet } from "../model/member-actions";
import {
  levelStateOf,
  levelsById,
  pendingReviews,
  startTenths,
  type LevelState,
} from "../model/member-levels";
import {
  initialMembersScreenState,
  membersScreenReducer,
  type MembersScreenAction,
  type LevelSheetState,
  type MembersScreenState,
} from "../model/members-screen.reducer";
import { canManageInvites } from "../model/members.selectors";
import { revokeListedInvite } from "../queries/invite-link-flow";
import { setLevelMutation } from "../queries/level-mutations";
import {
  changeRoleMutation,
  changeTypeMutation,
  leaveGroupMutation,
  removeMemberMutation,
} from "../queries/member-mutations";
import {
  useGroup,
  useGroupInvites,
  useGroupMembers,
  useMemberLevels,
} from "../queries/use-group-queries";

/** The sheet 19a of one member, derived each render from the cache and the draft of the reducer. */
export interface LevelSheetModel {
  readonly target: Member;
  readonly level: LevelState;
  /** The draft, else the level of the server, else the suggestion, else 3,0. */
  readonly shown: LevelTenths;
}

/** What the admin sees of each row; `null` for Placar and Jogador (they never ask, ADR 0047). */
export type LevelLookup = ((memberId: string) => LevelState) | null;

export function levelLookupOf(levels: readonly MemberLevel[] | undefined): LevelLookup {
  if (levels === undefined) return null;
  const byId = levelsById(levels);
  return (memberId) => levelStateOf(byId.get(memberId));
}

export function levelSheetOf(
  members: readonly Member[] | undefined,
  lookup: LevelLookup,
  sheet: LevelSheetState | null,
): LevelSheetModel | null {
  if (members === undefined || lookup === null || sheet === null) return null;
  const target = members.find((member) => member.memberId === sheet.memberId);
  if (target === undefined) return null;
  const level = lookup(target.memberId);
  return { target, level, shown: sheet.draft ?? startTenths(level) };
}

export interface MembersScreenModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly members: ReturnType<typeof useGroupMembers>;
  readonly invites: ReturnType<typeof useGroupInvites>;
  readonly state: MembersScreenState;
  readonly dispatch: (action: MembersScreenAction) => void;
  /** The sheet 19c of the open row, derived from the cache each render (frontend.md, rule 1). */
  readonly sheet: MemberSheet | null;
  readonly canInvite: boolean;
  /** Admin and co-admin: the levels, the pending strip and the privacy line exist only for them. */
  readonly levelOf: LevelLookup;
  readonly pendingCount: number;
  readonly levelSheet: LevelSheetModel | null;
  readonly pending: boolean;
  /** The text of the last refused write, or `null`. */
  readonly errorText: string | null;
  readonly changeRole: (target: Member, role: GroupRole) => void;
  readonly changeType: (target: Member, memberType: MemberType) => void;
  readonly leave: (onLeft: () => void) => void;
  readonly revokeInvite: (inviteId: string) => void;
  readonly removeMember: (target: Member) => void;
  readonly saveLevel: (memberId: string, tenths: LevelTenths) => void;
}

/** The sheet of the row `memberId`, read again from the members each render. */
export function sheetOf(
  members: readonly Member[] | undefined,
  memberId: string | null,
): MemberSheet | null {
  if (members === undefined || memberId === null) return null;
  const me = members.find((member) => member.isMe);
  const target = members.find((member) => member.memberId === memberId);
  return me === undefined || target === undefined ? null : memberActions(me, target, members);
}

/** Screen 19: the queries, the reducer and the writes; the screen only draws (D6). */
export function useMembersScreen(groupId: string): MembersScreenModel {
  const { sacouApi, inviteLinkStore } = useServices();
  const client = useQueryClient();
  const deps = { api: sacouApi, client, store: inviteLinkStore };
  const group = useGroup(groupId);
  const canInvite = group.data !== undefined && canManageInvites(group.data.role);
  const members = useGroupMembers(groupId);
  const invites = useGroupInvites(groupId, canInvite);
  const canRate = group.data !== undefined && canManageLevels(group.data.role);
  const levels = useMemberLevels(groupId, canRate);
  const levelOf = canRate ? levelLookupOf(levels.data) : null;
  const [state, dispatch] = useReducer(membersScreenReducer, initialMembersScreenState);
  const role = useMutation(changeRoleMutation(deps, groupId));
  const type = useMutation(changeTypeMutation(deps, groupId));
  const leave = useMutation(leaveGroupMutation(deps, groupId));
  const remove = useMutation(removeMemberMutation(deps, groupId));
  const setLevel = useMutation(setLevelMutation(deps, groupId));
  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeListedInvite(deps, groupId, inviteId),
  });
  const writes = [role, type, leave, revoke, remove, setLevel];
  const failed = writes.find((write) => write.isError);
  return {
    group,
    members,
    invites,
    state,
    dispatch,
    sheet: sheetOf(members.data, state.sheetMemberId),
    canInvite,
    levelOf,
    pendingCount:
      levelOf === null || members.data === undefined || levels.data === undefined
        ? 0
        : pendingReviews(members.data, levels.data).length,
    levelSheet: levelSheetOf(members.data, levelOf, state.level),
    pending: writes.some((write) => write.isPending),
    errorText: failed === undefined ? null : errorTextOf(failed.error),
    changeRole: (target, next) => {
      if (next !== target.role) role.mutate({ target, role: next });
    },
    changeType: (target, next) => {
      if (next !== target.memberType) type.mutate({ target, memberType: next });
    },
    leave: (onLeft) => {
      dispatch({ type: "confirm-closed" });
      leave.mutate(undefined, { onSuccess: onLeft });
    },
    revokeInvite: (inviteId) => {
      dispatch({ type: "confirm-closed" });
      revoke.mutate(inviteId);
    },
    removeMember: (target) => {
      dispatch({ type: "confirm-closed" });
      remove.mutate(target);
    },
    saveLevel: (memberId, tenths) => {
      setLevel.mutate(
        { memberId, level: wireLevel(tenths) },
        {
          onSuccess: () => {
            dispatch({ type: "level-closed" });
          },
        },
      );
    },
  };
}
