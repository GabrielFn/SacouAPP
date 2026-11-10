import type { HttpTransport } from "../services/api/http-transport";

/**
 * The platform `fetch`, only here (E4.2, D4). `redirect: "manual"`: a redirect never takes the
 * `Authorization` header to another host; the client also refuses an answer from another origin, in case
 * the React Native `fetch` ignores the option (plan, Risks).
 */
export const fetchHttpTransport: HttpTransport = (request) =>
  fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
    redirect: "manual",
  });
