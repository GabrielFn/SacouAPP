/** One request as the API client sends it: only to the API's origin, never following a redirect. */
export interface HttpRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: string | null;
  readonly signal: AbortSignal;
}

/** The injected `fetch` (E4.2, D4): the real one in `src/adapters/`, a queue of answers in the tests. */
export type HttpTransport = (request: HttpRequest) => Promise<Response>;
