import { strings } from "../../../strings/pt-BR";

// Scheme and host, with an optional port: no path, no query and no fragment (ADR 0049, D7).
const ORIGIN = /^(https?):\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?)$/i;
/** The token goes after the `#`: a browser never sends it to a server nor a proxy log (`grupos.md`). */
const INVITE_PATH = "/c#";
/** How much of the token the screen shows: enough to tell two links apart, not to type one. */
export const SHOWN_TOKEN_CHARS = 6;
const ELLIPSIS = "…";
const WHATSAPP_SEND = "whatsapp://send?text=";

/**
 * The origin of the invite page (`EXPO_PUBLIC_INVITE_BASE_URL`, question 33), or `null`: the invite
 * buttons then hide. `http:` only in a development build.
 */
export function parseInviteBaseUrl(raw: unknown, isDevelopment: boolean): string | null {
  if (typeof raw !== "string") return null;
  const match = ORIGIN.exec(raw);
  if (!match) return null;
  const [origin, scheme = ""] = match;
  if (scheme.toLowerCase() === "http" && !isDevelopment) return null;
  return origin.toLowerCase();
}

/** The whole link, built only when it is shown, copied or sent. */
export function inviteLink(baseUrl: string, token: string): string {
  return `${baseUrl}${INVITE_PATH}${token}`;
}

/** `sacou.app/c#K7fQ2x…`: no scheme, and only the start of the token. */
export function displayInviteLink(baseUrl: string, token: string): string {
  const host = baseUrl.replace(/^https?:\/\//i, "");
  return `${host}${INVITE_PATH}${token.slice(0, SHOWN_TOKEN_CHARS)}${ELLIPSIS}`;
}

export function inviteMessage(groupName: string, link: string): string {
  return strings.invite.message(groupName, link);
}

/** The app of WhatsApp only: `wa.me` would open the browser, with the token in the address. */
export function whatsappUrl(message: string): string {
  return `${WHATSAPP_SEND}${encodeURIComponent(message)}`;
}
