import { createFakeHttpTransport, jsonAnswer, type FakeHttpTransport } from "./fake-http-transport";
import { createFakeIdTokenProvider, type FakeIdTokenProvider } from "./fake-id-token-provider";
import { createHttpSacouApi } from "./http-sacou-api";

/** Shared by the tests of the HTTP adapter (`http-sacou-api*.test.ts`). */
export const BASE = "https://api.example";
export const GROUP = "8a4c2f0e-1111-4c3b-9d2e-000000000001";
export const NOW = Date.parse("2026-11-10T12:00:00Z");

export function setup(options: { baseUrl?: string | null; tokens?: FakeIdTokenProvider } = {}) {
  const http = createFakeHttpTransport();
  const tokens = options.tokens ?? createFakeIdTokenProvider();
  const api = createHttpSacouApi({
    baseUrl: options.baseUrl === undefined ? BASE : options.baseUrl,
    transport: http.transport,
    idTokens: tokens,
    now: () => NOW,
    timeoutMs: 20,
  });
  return { api, http, tokens };
}

export function problem(status: number, code?: string): Response {
  return jsonAnswer(status, { title: "x", status, ...(code === undefined ? {} : { code }) });
}

export function only(http: FakeHttpTransport) {
  const [request] = http.requests();
  if (!request) throw new Error("nothing was sent");
  return request;
}
