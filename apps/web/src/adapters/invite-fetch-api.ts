import type { InvitePreview } from "../invite-page/invite-page.types";
import type { InviteApiPort } from "../invite-page/ports";

import { createApiClient, isRecord, type FetchApiOptions } from "./api-client";

function previewOf(body: unknown): InvitePreview | null {
  if (!isRecord(body)) return null;
  const { groupName, activeMembers, alreadyMember } = body;
  if (typeof groupName !== "string" || typeof alreadyMember !== "boolean") return null;
  if (typeof activeMembers !== "number" || !Number.isInteger(activeMembers)) return null;
  return { groupName, activeMembers, alreadyMember };
}

/**
 * The invite routes (ADR 0040, D10) through the shared client: the token goes in the JSON body only, so neither the
 * Cloud Run log nor a proxy sees it. The accept's IDs are not read: the page has nothing to do with them.
 */
export function createInviteFetchApi(options: FetchApiOptions): InviteApiPort {
  const { call, read, send } = createApiClient(options);
  return {
    register: () => send("POST", "/v1/me"),
    preview: async (token) => read(await call("POST", "/v1/invites/preview", { token }), previewOf),
    accept: (token) => send("POST", "/v1/invites/accept", { token }),
  };
}
