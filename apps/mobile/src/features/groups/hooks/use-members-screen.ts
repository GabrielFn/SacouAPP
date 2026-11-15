import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { GroupRole, Member, MemberType } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { memberActions, type MemberSheet } from "../model/member-actions";
import {
  initialMembersScreenState,
  membersScreenReducer,
  type MembersScreenAction,
  type MembersScreenState,
} from "../model/members-screen.reducer";
import { canManageInvites } from "../model/members.selectors";
import { revokeListedInvite } from "../queries/invite-link-flow";
import {
  changeRoleMutation,
  changeTypeMutation,
  leaveGroupMutation,
} from "../queries/member-mutations";
import { useGroup, useGroupInvites, useGroupMembers } from "../queries/use-group-queries";

export interface MembersScreenModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly members: ReturnType<typeof useGroupMembers>;
  readonly invites: ReturnType<typeof useGroupInvites>;
  readonly state: MembersScreenState;
  readonly dispatch: (action: MembersScreenAction) => void;
  /** The sheet 19c of the open row, derived from the cache each render (frontend.md, rule 1). */
  readonly sheet: MemberSheet | null;
  readonly canInvite: boolean;
  readonly pending: boolean;
  /** The text of the last refused write, or `null`. */
  readonly errorText: string | null;
  readonly changeRole: (target: Member, role: GroupRole) => void;
  readonly changeType: (target: Member, memberType: MemberType) => void;
  readonly leave: (onLeft: () => void) => void;
  readonly revokeInvite: (inviteId: string) => void;
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
  const [state, dispatch] = useReducer(membersScreenReducer, initialMembersScreenState);
  const role = useMutation(changeRoleMutation(deps, groupId));
  const type = useMutation(changeTypeMutation(deps, groupId));
  const leave = useMutation(leaveGroupMutation(deps, groupId));
  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeListedInvite(deps, groupId, inviteId),
  });
  const writes = [role, type, leave, revoke];
  const failed = writes.find((write) => write.isError);
  return {
    group,
    members,
    invites,
    state,
    dispatch,
    sheet: sheetOf(members.data, state.sheetMemberId),
    canInvite,
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
  };
}
