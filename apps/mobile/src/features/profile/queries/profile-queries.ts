import { queryOptions, skipToken, type QueryClient } from "@tanstack/react-query";

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
 * The profile has the level the person suggests for themselves: `["me", "profile"]` is outside the
 * persisted allow list (ADR 0047), so it lives only in memory and goes with `clearSession`.
 */
export function myProfileQuery(api: SacouApi, enabled: boolean, client: QueryClient) {
  return queryOptions({
    queryKey: queryKeys.myProfile(),
    queryFn: async () => {
      const profile = await fetchMyProfile(api);
      if (profile !== null) client.setQueryData(queryKeys.myNickname(), profile.nickname);
      return profile;
    },
    staleTime: MY_PROFILE_STALE_MS,
    enabled,
  });
}

/**
 * The nickname alone is persisted (allow list, D6), so the greeting has it without a network. The
 * profile query writes it; nothing fetches it: `skipToken` only reads what is in the cache.
 */
export function myNicknameQuery() {
  return queryOptions<string>({
    queryKey: queryKeys.myNickname(),
    queryFn: skipToken,
    staleTime: Infinity,
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
