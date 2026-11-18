import type { MyProfile } from "../../../services/api/sacou-api";

/**
 * On disk the profile keeps only its nickname (ADR 0057, D9), so a profile restored from there has no
 * positions nor level: it serves the greeting and the account, never the edit form.
 */
export function isProfileStub(profile: MyProfile): boolean {
  return !("otherPositions" in profile);
}

/** The nickname the greeting shows: none while loading or without a saved profile. */
export function greetingNicknameOf(profile: MyProfile | null | undefined): string | null {
  return profile?.nickname ?? null;
}
