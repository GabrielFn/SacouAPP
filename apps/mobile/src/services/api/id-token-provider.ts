/**
 * Where the client gets the Firebase ID token (the `AuthSession`, through `sessionIdTokens`). The token is passed to the
 * HTTP client and to nothing else: never to a query key, a log or the cache (E4.2, D7).
 */
export interface IdTokenProvider {
  /**
   * `null` when nobody is signed in or the SDK refused the renewal (token revoked, user disabled): the
   * session is then over. `forceRefresh` asks Firebase for a new token (after a 401). It rejects only when
   * the token could not be renewed for lack of network: the call is then `offline`.
   */
  getIdToken(options: { readonly forceRefresh: boolean }): Promise<string | null>;
  /** The API refused even a fresh token: the session is over (the `SessionEnder` signs out and clears). */
  onSessionExpired(): void;
  /**
   * `POST /v1/me` answered 410 `identity.account-deleted`: the server deleted this account and the phone
   * still has it in Firebase. The `SessionEnder` deletes it there and ends the session (ADR 0056, D5).
   */
  onAccountDeleted(): void;
}
