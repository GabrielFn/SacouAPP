import type { QueryClient } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { GroupRole, Member, MemberType, SacouApi } from "../../../services/api/sacou-api";
import {
  applyCacheEffects,
  cacheEffectsOf,
  conflictEffects,
} from "../../../services/query/invalidation";
import { losesInvites } from "../model/member-actions";
import type { InviteLinkStore } from "../ports/invite-link-store";

export interface MemberMutationDeps {
  readonly api: SacouApi;
  readonly client: QueryClient;
  readonly store: InviteLinkStore;
}

export interface RoleChange {
  readonly target: Member;
  readonly role: GroupRole;
}

export interface TypeChange {
  readonly target: Member;
  readonly memberType: MemberType;
}

/** One queue per group: two writes of members never cross on the way (ADR 0040, D8). */
function membersScope(groupId: string): { readonly id: string } {
  return { id: `members-${groupId}` };
}

function refusedBy(client: QueryClient, groupId: string) {
  return (error: unknown) => {
    applyCacheEffects(client, conflictEffects(groupId, error));
  };
}

export function changeRoleMutation(deps: MemberMutationDeps, groupId: string) {
  return {
    scope: membersScope(groupId),
    mutationFn: async (change: RoleChange) => {
      const ref = { groupId, memberId: change.target.memberId };
      await unwrap(deps.api.changeMemberRole(ref, change.role));
      return change;
    },
    onSuccess: async ({ target, role }: RoleChange) => {
      const targetIsMe = target.isMe;
      applyCacheEffects(
        deps.client,
        cacheEffectsOf({ type: "changeMemberRole", groupId, targetIsMe }),
      );
      // The server killed the links of who became Placar or Jogador; the copy goes too (D6).
      if (targetIsMe && losesInvites(role)) await deps.store.remove(groupId);
    },
    onError: refusedBy(deps.client, groupId),
  };
}

export function changeTypeMutation(deps: MemberMutationDeps, groupId: string) {
  return {
    scope: membersScope(groupId),
    mutationFn: async (change: TypeChange) => {
      const ref = { groupId, memberId: change.target.memberId };
      await unwrap(deps.api.changeMemberType(ref, change.memberType));
      return change;
    },
    onSuccess: ({ target }: TypeChange) => {
      const targetIsMe = target.isMe;
      applyCacheEffects(
        deps.client,
        cacheEffectsOf({ type: "changeMemberType", groupId, targetIsMe }),
      );
    },
    onError: refusedBy(deps.client, groupId),
  };
}

export function leaveGroupMutation(deps: MemberMutationDeps, groupId: string) {
  return {
    scope: membersScope(groupId),
    mutationFn: () => unwrap(deps.api.leaveGroup(groupId)),
    onSuccess: async () => {
      applyCacheEffects(deps.client, cacheEffectsOf({ type: "leaveGroup", groupId }));
      await deps.store.remove(groupId);
    },
    onError: refusedBy(deps.client, groupId),
  };
}
