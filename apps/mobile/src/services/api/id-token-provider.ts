/**
 * Where the client gets the Firebase ID token (E4.3 brings the real one). The token is passed to the
 * HTTP client and to nothing else: never to a query key, a log or the cache (E4.2, D7).
 */
export interface IdTokenProvider {
  /** `null` when nobody is signed in. `forceRefresh` asks Firebase for a new token (after a 401). */
  getIdToken(options: { readonly forceRefresh: boolean }): Promise<string | null>;
  /** The API refused even a fresh token: the session is over (E4.3 signs out and clears the cache). */
  onSessionExpired(): void;
}
