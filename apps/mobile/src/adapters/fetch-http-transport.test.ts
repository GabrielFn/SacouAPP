import { afterEach, describe, expect, test, vi } from "vitest";

import { fetchHttpTransport } from "./fetch-http-transport";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetch-http-transport (H4)", () => {
  test("never follows a redirect, so the token stays with the API origin", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchSpy);
    const headers = new Headers({ Authorization: "Bearer t" });
    const signal = new AbortController().signal;

    await fetchHttpTransport({
      url: "https://api.example/v1/groups",
      method: "GET",
      headers,
      body: null,
      signal,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example/v1/groups", {
      method: "GET",
      headers,
      body: null,
      signal,
      redirect: "manual",
    });
  });
});
