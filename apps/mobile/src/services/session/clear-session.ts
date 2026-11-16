import type { InviteLinkStore } from "../../features/groups/ports/invite-link-store";
import type { OnboardingSkip } from "../../features/profile/ports/onboarding-skip";
import type { CacheSession } from "../query/cache-persister";

export interface SessionStores {
  readonly cacheSession: CacheSession;
  readonly inviteLinkStore: InviteLinkStore;
  /** "Pular" of screen 27 belongs to the session: the next account is asked again. */
  readonly onboardingSkip: Pick<OnboardingSkip, "clear">;
}

/**
 * Sign-out forgets everything of the person on this phone: the server cache (the profile with it), every
 * invite link and the "Pular" of the quick profile.
 */
export async function clearSession(stores: SessionStores): Promise<void> {
  await Promise.all([
    stores.cacheSession.clearSession(),
    stores.inviteLinkStore.clearAll(),
    stores.onboardingSkip.clear(),
  ]);
}
