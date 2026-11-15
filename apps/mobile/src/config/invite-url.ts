import { parseInviteBaseUrl } from "../features/groups/model/invite-link";

// Expo replaces this exact expression when it bundles, so it cannot be read through a variable.
const RAW_INVITE_URL: unknown = process.env.EXPO_PUBLIC_INVITE_BASE_URL;

/** The origin of the invite links of this build, or `null` until there is a domain (question 33). */
export function buildInviteBaseUrl(isDevelopment: boolean): string | null {
  return parseInviteBaseUrl(RAW_INVITE_URL, isDevelopment);
}
