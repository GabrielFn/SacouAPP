/**
 * Where the client gets the Firebase ID token (the `AuthSession`, through `sessionIdTokens`). The token is passed to the
 * HTTP client and to nothing else: never to a query key, a log or the cache (E4.2, D7).
 */
export interface IdTokenProvider {
  /**
   * `null` when nobody is signed in. `forceRefresh` asks Firebase for a new token (after a 401). It
   * rejects when the token could not be renewed (no network): the call is then `offline`.
   */
  getIdToken(options: { readonly forceRefresh: boolean }): Promise<string | null>;
  /** The API refused even a fresh token: the session is over (the `SessionEnder` signs out and clears). */
  onSessionExpired(): void;
}
