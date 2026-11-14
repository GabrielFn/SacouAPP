import type { Query } from "@tanstack/react-query";

import { apiContractHash } from "../../api/generated/contract-hash";
import type { SacouQueryKey } from "./query-keys";

const MS_PER_DAY = 86_400_000;
const DAYS_KEPT = 7;
/** Data kept from the last time is shown for a week, the rhythm of a weekly racha (question 20). */
export const PERSISTED_CACHE_MAX_AGE_MS = DAYS_KEPT * MS_PER_DAY;

const GROUP_KEY_LENGTH = 2;
const CHILD_KEY_LENGTH = 3;
const ROUND_KEY_LENGTH = 4;

/** What is kept under a group: the members, the settings and the rounds (the venue is free text, ADR 0049 and 0054). */
const PERSISTED_CHILDREN: ReadonlySet<unknown> = new Set(["members", "settings", "rounds"]);

/**
 * The allow list of the persisted cache (D6): the groups, a group, its members, its settings, its rounds and one round (the screen opens without a network on the court, ADR 0054). The
 * default is not to persist: `["me"]` (the internal user ID), the invites and the saved templates (admin
 * only) and anything unknown stay out.
 */
export function isPersistedKey(key: SacouQueryKey): boolean {
  const [root, groupId, child] = key;
  if (root !== "groups") return false;
  if (key.length === 1) return true;
  if (typeof groupId !== "string") return false;
  if (key.length === ROUND_KEY_LENGTH) return child === "rounds" && typeof key[3] === "string";
  return (
    key.length === GROUP_KEY_LENGTH ||
    (key.length === CHILD_KEY_LENGTH && PERSISTED_CHILDREN.has(child))
  );
}

/** Only answers that arrived: an error, or a query still loading, is never written. */
export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">): boolean {
  return query.state.status === "success" && isPersistedKey(query.queryKey);
}

/** A cache written by another version of the app, or against another contract, is dropped (D6). */
export function cacheBuster(appVersion: string): string {
  return `${appVersion}+${apiContractHash}`;
}
