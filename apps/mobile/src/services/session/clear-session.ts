import type { InviteLinkStore } from "../../features/groups/ports/invite-link-store";
import type { CacheSession } from "../query/cache-persister";

export interface SessionStores {
  readonly cacheSession: CacheSession;
  readonly inviteLinkStore: InviteLinkStore;
}

/** Sign-out forgets everything of the person on this phone: the server cache and every invite link. */
export async function clearSession(stores: SessionStores): Promise<void> {
  await Promise.all([stores.cacheSession.clearSession(), stores.inviteLinkStore.clearAll()]);
}
