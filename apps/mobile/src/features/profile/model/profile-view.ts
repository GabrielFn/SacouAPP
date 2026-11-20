import { apiErrorOf, type ApiError } from "../../../services/api/api-error";
import type { MyStats } from "../../../services/api/sacou-api";
import type { StoredProfile } from "./profile-stub";

/** What a query says, as plain data, so the derivation needs no React. */
export interface QuerySnapshot<T> {
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly data: T | undefined;
  readonly error: unknown;
}

export type ProfileView =
  | { readonly kind: "loading" }
  | { readonly kind: "offline-empty" }
  | { readonly kind: "error"; readonly error: ApiError }
  | {
      /** Zero matches: the card with zeros and dashes, and the line that says why. */
      readonly kind: "empty" | "ready";
      readonly profile: StoredProfile;
      readonly stats: MyStats;
      /** The numbers are the ones kept from the last time: the "Sem conexão" strip shows. */
      readonly stale: boolean;
    };

const UNKNOWN_ERROR: ApiError = { kind: "unexpected", status: 0 };

function failureOf(snapshot: QuerySnapshot<unknown>): ProfileView | null {
  if (snapshot.status !== "error") return null;
  const error = apiErrorOf(snapshot.error) ?? UNKNOWN_ERROR;
  return error.kind === "offline" ? { kind: "offline-empty" } : { kind: "error", error };
}

/**
 * One state for the "Eu" tab, derived from the two queries and the network (frontend.md, rule 1). A
 * missing profile (404) is not drawn: the session gate opens screen 27 (E4.3). The cache of another
 * account never gets here: `clearSession` removes the keys.
 */
export function profileView(
  profile: QuerySnapshot<StoredProfile | null>,
  stats: QuerySnapshot<MyStats>,
  online: boolean,
): ProfileView {
  if (profile.data === undefined) return failureOf(profile) ?? { kind: "loading" };
  if (profile.data === null) return { kind: "loading" };
  if (stats.data === undefined) {
    const failure = failureOf(stats);
    if (failure !== null) return failure;
    return stats.fetchStatus === "paused" ? { kind: "offline-empty" } : { kind: "loading" };
  }
  return {
    kind: stats.data.total.matchesPlayed === 0 ? "empty" : "ready",
    profile: profile.data,
    stats: stats.data,
    stale: !online,
  };
}
