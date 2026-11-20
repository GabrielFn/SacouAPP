/** 32 random bytes in Base64url without padding (ADR 0040, D10). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const FRAGMENT_MARK = "#";

/** The parts of `location` the page reads: never `href`, which carries the fragment. */
export interface LocationLike {
  readonly hash: string;
  readonly pathname: string;
  readonly search: string;
}

export interface HistoryLike {
  replaceState(data: unknown, unused: string, url: string): void;
}

/**
 * Reads the invite token after the `#` and takes the fragment off the address at once (ADR 0070, D8): it stays neither
 * in the history nor in a screenshot of the bar. The first thing the page does, before Firebase or any request. A
 * token out of its format is no token: the page then asks nothing of the API.
 */
export function takeInviteToken(location: LocationLike, history: HistoryLike): string | null {
  const fragment = location.hash.startsWith(FRAGMENT_MARK) ? location.hash.slice(1) : location.hash;
  if (location.hash !== "") history.replaceState(null, "", location.pathname + location.search);
  return TOKEN_PATTERN.test(fragment) ? fragment : null;
}
