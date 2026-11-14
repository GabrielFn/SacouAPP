import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import type { ExternalLink } from "../../../services/links/external-link";
import {
  applyCacheEffects,
  cacheEffectsOf,
  conflictEffects,
} from "../../../services/query/invalidation";
import type { ShareSheet } from "../../../services/share/share-sheet";
import { whatsappUrl } from "../model/invite-link";
import type { InviteLinkStore, StoredInviteLink } from "../ports/invite-link-store";
import { groupInvitesQuery } from "./group-queries";

export interface InviteFlowDeps {
  readonly api: SacouApi;
  readonly store: InviteLinkStore;
  readonly client: QueryClient;
}

/** A failed write of the copy does not lose the link: it is shown now, and another is made next time. */
async function keep(store: InviteLinkStore, groupId: string, link: StoredInviteLink): Promise<void> {
  try {
    await store.save(groupId, link);
  } catch {
    // Nothing to tell: the screen has the link in the result of the mutation.
  }
}

async function createAndKeep(deps: InviteFlowDeps, groupId: string): Promise<StoredInviteLink> {
  try {
    const created = await unwrap(deps.api.createInvite(groupId));
    applyCacheEffects(deps.client, cacheEffectsOf({ type: "createInvite", groupId }));
    const link = { inviteId: created.inviteId, token: created.token };
    await keep(deps.store, groupId, link);
    return link;
  } catch (error) {
    applyCacheEffects(deps.client, conflictEffects(groupId, error));
    throw error;
  }
}

/**
 * The link of screen 19d: the one this phone keeps while the server still lists it, otherwise a new one
 * (ADR 0049, D7). The token comes back only here and goes to the store, never to the query cache.
 */
export async function openInviteLink(
  deps: InviteFlowDeps,
  groupId: string,
): Promise<StoredInviteLink> {
  const stored = await deps.store.read(groupId);
  if (stored !== null) {
    const invites = await deps.client.fetchQuery(groupInvitesQuery(deps.api, groupId, true));
    if (invites.some((invite) => invite.inviteId === stored.inviteId)) return stored;
    await deps.store.remove(groupId);
  }
  return createAndKeep(deps, groupId);
}

/** A revoke of an invite that is already gone is what was wanted. */
function isGone(error: unknown): boolean {
  const apiError = apiErrorOf(error);
  return apiError?.kind === "problem" && apiError.code === "groups.invite-not-found";
}

async function revoke(deps: InviteFlowDeps, groupId: string, inviteId: string): Promise<void> {
  try {
    await unwrap(deps.api.revokeInvite(groupId, inviteId));
  } catch (error) {
    if (!isGone(error)) throw error;
  }
  applyCacheEffects(deps.client, cacheEffectsOf({ type: "revokeInvite", groupId }));
}

/** "Desativar este link e gerar outro": revoke the one shown, forget the copy, make another. */
export async function regenerateInviteLink(
  deps: InviteFlowDeps,
  groupId: string,
  shownInviteId: string,
): Promise<StoredInviteLink> {
  await revoke(deps, groupId, shownInviteId);
  await deps.store.remove(groupId);
  return createAndKeep(deps, groupId);
}

/** "Revogar" on the invites tab: the copy goes too when it was this one. */
export async function revokeListedInvite(
  deps: InviteFlowDeps,
  groupId: string,
  inviteId: string,
): Promise<void> {
  await revoke(deps, groupId, inviteId);
  const stored = await deps.store.read(groupId);
  if (stored?.inviteId === inviteId) await deps.store.remove(groupId);
}

/** WhatsApp, and the share sheet of the system on a phone without it (ADR 0049, D7). */
export async function sendInviteOnWhatsApp(
  externalLink: ExternalLink,
  shareSheet: ShareSheet,
  message: string,
): Promise<void> {
  const opened = await externalLink.open(whatsappUrl(message));
  if (!opened) await shareSheet.share(message);
}
