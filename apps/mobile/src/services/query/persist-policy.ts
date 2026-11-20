import type { Query } from "@tanstack/react-query";

import { apiContractHash } from "../../api/generated/contract-hash";
import { apiErrorOf, type ApiErrorKind } from "../api/api-error";
import type { SacouQueryKey } from "./query-keys";

const MS_PER_DAY = 86_400_000;
const DAYS_KEPT = 7;
/** Data kept from the last time is shown for a week, the rhythm of a weekly racha (question 20). */
export const PERSISTED_CACHE_MAX_AGE_MS = DAYS_KEPT * MS_PER_DAY;

const GROUP_KEY_LENGTH = 2;
const CHILD_KEY_LENGTH = 3;
const ROUND_KEY_LENGTH = 4;
const ROUND_CHILD_KEY_LENGTH = 5;

/** What is kept under a group: the members, the settings and the rounds (the venue is free text, ADR 0049 and 0054). */
const PERSISTED_CHILDREN: ReadonlySet<unknown> = new Set(["members", "settings", "rounds"]);

/**
 * The allow list of the persisted cache (D6): the groups, a group, its members, its settings, its rounds and one round and its summary (the screen opens without a network on the court, ADR 0054). The
 * default is not to persist: `["me"]` (the internal user ID; of `["me", "profile"]` only the nickname is written, never the level nor the positions: see `cache-persister.ts`), the invites and the saved templates (admin
 * only) and anything unknown stay out.
 */
export function isPersistedKey(key: SacouQueryKey): boolean {
  const [root, groupId] = key;
  if (root === "me") return key.length === GROUP_KEY_LENGTH && groupId === "profile";
  if (root !== "groups") return false;
  if (key.length === 1) return true;
  return typeof groupId === "string" && isPersistedGroupKey(key);
}

function isPersistedGroupKey(key: SacouQueryKey): boolean {
  const child = key[2];
  if (key.length === ROUND_KEY_LENGTH) return child === "rounds" && typeof key[3] === "string";
  if (key.length === ROUND_CHILD_KEY_LENGTH) {
    return child === "rounds" && typeof key[3] === "string" && key[4] === "summary";
  }
  return (
    key.length === GROUP_KEY_LENGTH ||
    (key.length === CHILD_KEY_LENGTH && PERSISTED_CHILDREN.has(child))
  );
}

/** Failures that say nothing about access (a 429 neither, ADR 0062): the last answer is still the person's to see. */
const TRANSIENT_FAILURES: ReadonlySet<ApiErrorKind> = new Set([
  "offline",
  "unavailable",
  "rate-limited",
]);

function isTransientFailure(error: unknown): boolean {
  const apiError = apiErrorOf(error);
  return apiError !== null && TRANSIENT_FAILURES.has(apiError.kind);
}

/**
 * Only answers that arrived: a query still loading is never written. A refetch that fails on the network
 * (the app opened with no network still takes itself as online until NetInfo speaks) keeps the last
 * answer in `data` with `status: "error"`: that answer stays on disk, or the failed refetch would write
 * the cache empty and the next offline opening would find nothing. Any other failure (403, 404, 410, an
 * expired session) drops it: someone removed from a group must not keep its members and rounds.
 */
export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">): boolean {
  const { status, data, error } = query.state;
  const keptOnTransientFailure =
    status === "error" && data !== undefined && isTransientFailure(error);
  return (status === "success" || keptOnTransientFailure) && isPersistedKey(query.queryKey);
}

/** A cache written by another version of the app, or against another contract, is dropped (D6). */
export function cacheBuster(appVersion: string): string {
  return `${appVersion}+${apiContractHash}`;
}
