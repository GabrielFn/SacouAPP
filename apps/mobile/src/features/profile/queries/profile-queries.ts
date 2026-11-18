import { queryOptions, type QueryClient } from "@tanstack/react-query";

import type { StoredProfile } from "../model/profile-stub";
import { ApiFailure } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { MyProfile, SacouApi, SaveMyProfileBody } from "../../../services/api/sacou-api";
import { applyCacheEffects, cacheEffectsOf } from "../../../services/query/invalidation";
import { groupIdOf, queryKeys } from "../../../services/query/query-keys";

/** Only this person changes the profile, from this screen: a short look again is enough. */
export const MY_PROFILE_STALE_MS = 300_000;
const PROFILE_NOT_FOUND = "identity.profile-not-found";

/** 404 `identity.profile-not-found` is an answer, not a failure: `null` means "never saved". */
export async function fetchMyProfile(api: SacouApi): Promise<MyProfile | null> {
  const result = await api.getMyProfile();
  if (result.ok) return result.value;
  if (result.error.kind === "problem" && result.error.code === PROFILE_NOT_FOUND) return null;
  throw new ApiFailure(result.error);
}

/**
 * The profile has the level the person suggests for themselves, and is the one record of the nickname.
 * On disk only the nickname is written (the persister strips the rest, ADR 0057 D9 and ADR 0047), so a
 * restored copy is a stub (`isProfileStub`); `clearSession` removes both.
 */
export function myProfileQuery(api: SacouApi, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.myProfile(),
    queryFn: (): Promise<StoredProfile | null> => fetchMyProfile(api),
    staleTime: MY_PROFILE_STALE_MS,
    enabled,
  });
}

/** The groups that have something in the cache: their members show the nickname. */
export function cachedGroupIds(client: QueryClient): readonly string[] {
  const keys = client
    .getQueryCache()
    .findAll({ queryKey: queryKeys.groups() })
    .map((query) => groupIdOf(query.queryKey));
  return [...new Set(keys.filter((groupId) => groupId !== null))];
}

export interface ProfileMutationDeps {
  readonly api: SacouApi;
  readonly client: QueryClient;
}

/** "Pronto", "Salvar" and the nickname of "Pular": the answer is the profile, written to the cache. */
export function saveProfileMutation(deps: ProfileMutationDeps) {
  return {
    scope: { id: "my-profile" },
    gcTime: 0,
    mutationFn: (body: SaveMyProfileBody) => unwrap(deps.api.saveMyProfile(body)),
    onSuccess: (profile: MyProfile) => {
      applyCacheEffects(
        deps.client,
        cacheEffectsOf({
          type: "profileSaved",
          profile,
          nickname: profile.nickname,
          cachedGroupIds: cachedGroupIds(deps.client),
        }),
      );
    },
  };
}
