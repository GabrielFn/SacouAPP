import type { MyProfile } from "../../../services/api/sacou-api";

/**
 * On disk the profile keeps only its nickname (ADR 0057, D9), so a profile restored from there has no
 * positions nor level: it serves the greeting and the account, never the edit form.
 */
export type ProfileStub = Pick<MyProfile, "nickname">;

/** What the profile query holds: the whole profile, the stub restored from disk, or `null` (never saved). */
export type StoredProfile = MyProfile | ProfileStub;

export function isProfileStub(profile: StoredProfile): profile is ProfileStub {
  return !("otherPositions" in profile);
}

/** The nickname the greeting shows: none while loading or without a saved profile. */
export function greetingNicknameOf(profile: StoredProfile | null | undefined): string | null {
  return profile?.nickname ?? null;
}

export type EditProfileView = "loading" | "error" | "form";

export interface EditProfileQueryView {
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly data: StoredProfile | null | undefined;
}

/**
 * Which state screen 27 shows in edit mode. A stub restored from disk is never the form's initial
 * state: the screen waits for the fetch and, when none is running (no network), offers to retry.
 */
export function editProfileView(query: EditProfileQueryView): EditProfileView {
  if (query.status === "pending") return "loading";
  if (query.status === "error") return "error";
  if (query.data != null && isProfileStub(query.data)) {
    return query.fetchStatus === "fetching" ? "loading" : "error";
  }
  return "form";
}
