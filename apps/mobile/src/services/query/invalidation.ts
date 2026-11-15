import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../api/api-error";
import { groupIdOf, queryKeys, type SacouQueryKey } from "./query-keys";

/** A mutation that went through, as the cache needs to know it (D6). */
export type MutationEvent =
  | { readonly type: "createGroup" | "acceptInvite" }
  | { readonly type: "renameGroup" | "leaveGroup"; readonly groupId: string }
  | { readonly type: "createInvite" | "revokeInvite"; readonly groupId: string }
  /** The server answered with the whole settings document: it replaces the cached one (ADR 0049). */
  | { readonly type: "settingsReplaced"; readonly groupId: string; readonly view: unknown }
  | { readonly type: "templatesChanged"; readonly groupId: string }
  /** The server answered with the whole round: it replaces the cached detail (ADR 0054). */
  | {
      readonly type: "roundCreated" | "roundUpdated";
      readonly groupId: string;
      readonly roundId: string;
      readonly round: unknown;
    }
  /** The place of the others moved: only the server knows how, so the detail is read again. */
  | { readonly type: "attendanceChanged"; readonly groupId: string; readonly roundId: string }
  /** A change of the settings was refused for lack of permission: the role is stale. */
  | { readonly type: "settingsForbidden"; readonly groupId: string }
  | {
      readonly type: "changeMemberRole" | "changeMemberType" | "removeMember";
      readonly groupId: string;
      /** The caller changed itself: its own role or type in the list of groups changed too. */
      readonly targetIsMe: boolean;
    };

/**
 * `invalidateExact` touches only the query of that key, not the ones under it: the list of rounds is read
 * again without throwing away the detail that was just written (ADR 0054, D3).
 */
export type CacheEffect =
  | { readonly action: "invalidate" | "invalidateExact" | "remove"; readonly key: SacouQueryKey }
  | { readonly action: "set"; readonly key: SacouQueryKey; readonly data: unknown };

const invalidate = (key: SacouQueryKey): CacheEffect => ({ action: "invalidate", key });
const remove = (key: SacouQueryKey): CacheEffect => ({ action: "remove", key });

type MemberEvent = Extract<MutationEvent, { readonly targetIsMe: boolean }>;
type SettingsEvent = Extract<
  MutationEvent,
  { readonly type: "settingsReplaced" | "templatesChanged" | "settingsForbidden" }
>;

function isMemberEvent(event: MutationEvent): event is MemberEvent {
  return "targetIsMe" in event;
}

function memberEffects(event: MemberEvent): readonly CacheEffect[] {
  const members = invalidate(queryKeys.members(event.groupId));
  return event.targetIsMe ? [members, invalidate(queryKeys.groups())] : [members];
}

type RoundEvent = Extract<
  MutationEvent,
  { readonly type: "roundCreated" | "roundUpdated" | "attendanceChanged" }
>;

function isRoundEvent(event: MutationEvent): event is RoundEvent {
  return (
    event.type === "roundCreated" ||
    event.type === "roundUpdated" ||
    event.type === "attendanceChanged"
  );
}

function roundEffects(event: RoundEvent): readonly CacheEffect[] {
  const list: CacheEffect = { action: "invalidateExact", key: queryKeys.rounds(event.groupId) };
  const detail = queryKeys.round(event.groupId, event.roundId);
  return event.type === "attendanceChanged"
    ? [invalidate(detail), list]
    : [{ action: "set", key: detail, data: event.round }, list];
}

function isSettingsEvent(event: MutationEvent): event is SettingsEvent {
  return (
    event.type === "settingsReplaced" ||
    event.type === "templatesChanged" ||
    event.type === "settingsForbidden"
  );
}

function settingsEffects(event: SettingsEvent): readonly CacheEffect[] {
  switch (event.type) {
    case "settingsReplaced":
      return [{ action: "set", key: queryKeys.settings(event.groupId), data: event.view }];
    case "templatesChanged":
      return [invalidate(queryKeys.templates(event.groupId))];
    case "settingsForbidden":
      return [
        invalidate(queryKeys.group(event.groupId)),
        invalidate(queryKeys.settings(event.groupId)),
      ];
  }
}

/** What each mutation makes stale, pure and tested as a golden table (P5). */
export function cacheEffectsOf(event: MutationEvent): readonly CacheEffect[] {
  if (isMemberEvent(event)) return memberEffects(event);
  if (isSettingsEvent(event)) return settingsEffects(event);
  if (isRoundEvent(event)) return roundEffects(event);
  switch (event.type) {
    case "createGroup":
    case "acceptInvite":
      return [invalidate(queryKeys.groups())];
    case "renameGroup":
      return [invalidate(queryKeys.group(event.groupId)), invalidate(queryKeys.groups())];
    case "leaveGroup":
      return [remove(queryKeys.group(event.groupId)), invalidate(queryKeys.groups())];
    case "createInvite":
    case "revokeInvite":
      return [invalidate(queryKeys.invites(event.groupId))];
  }
}

const CONFLICT = 409;

/** A 409 shows its text and refreshes the resource, so the screen shows the state that won (D5). */
export function isConflict(error: unknown): boolean {
  const apiError = apiErrorOf(error);
  return apiError?.kind === "problem" && apiError.status === CONFLICT;
}

/** What a 409 makes stale, by the code of the rule it broke (ADR 0049, D5). */
const CONFLICT_STALE: Readonly<Record<string, (groupId: string) => SacouQueryKey>> = {
  "groups.last-admin": queryKeys.members,
  "groups.invite-limit": queryKeys.invites,
  "groups.template-limit": queryKeys.templates,
};

/** The queries of the group a 409 says are old; a 409 with another code touches nothing. */
export function conflictEffects(groupId: string, error: unknown): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  if (!isConflict(error) || apiError?.kind !== "problem") return [];
  const stale = CONFLICT_STALE[apiError.code];
  return stale === undefined ? [] : [invalidate(stale(groupId))];
}

/**
 * A group that is gone for this person (removed, or left on another phone) leaves the cache, the persisted
 * one included, and the list is fetched again (D5).
 */
export function groupGoneEffects(key: SacouQueryKey, error: unknown): readonly CacheEffect[] {
  const apiError = apiErrorOf(error);
  const groupId = groupIdOf(key);
  const gone = apiError?.kind === "problem" && apiError.code === "groups.group-not-found";
  return gone && groupId !== null
    ? [remove(queryKeys.group(groupId)), invalidate(queryKeys.groups())]
    : [];
}

export function applyCacheEffects(client: QueryClient, effects: readonly CacheEffect[]): void {
  effects.forEach((effect) => {
    if (effect.action === "set") client.setQueryData(effect.key, effect.data);
    else if (effect.action === "remove") client.removeQueries({ queryKey: effect.key });
    else
      void client.invalidateQueries({
        queryKey: effect.key,
        exact: effect.action === "invalidateExact",
      });
  });
}
