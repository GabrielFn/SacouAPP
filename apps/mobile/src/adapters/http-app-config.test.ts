import { describe, expect, test } from "vitest";

import { createHttpSacouApi } from "./http-sacou-api";
import { createFakeHttpTransport, emptyAnswer, jsonAnswer } from "./fake-http-transport";
import { createFakeIdTokenProvider } from "./fake-id-token-provider";
import { BASE, only, problem } from "./http-sacou-api.test-support";
import type { AppBuild } from "../features/app-config/app-build";

const CONFIG = {
  minimumBuild: { android: 5, ios: 1 },
  updateUrl: { android: null, ios: null },
  features: { mvpVote: true },
};

function setup(appBuild: AppBuild) {
  const http = createFakeHttpTransport();
  const tokens = createFakeIdTokenProvider();
  const api = createHttpSacouApi({
    baseUrl: BASE,
    transport: http.transport,
    idTokens: tokens,
    timeoutMs: 20,
    appBuild,
  });
  return { api, http };
}

describe("getAppConfig", () => {
  test("is anonymous: no Authorization header and no token read", async () => {
    const { api, http } = setup({ platform: "android", build: 7 });
    http.enqueue(jsonAnswer(200, CONFIG));

    const result = await api.getAppConfig();

    expect(result).toEqual({ ok: true, value: CONFIG });
    const request = only(http);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(`${BASE}/v1/app-config`);
    expect(request.headers.get("authorization")).toBeNull();
  });

  test("a 429 is a rate limit, never repeated", async () => {
    const { api, http } = setup({ platform: "android", build: 7 });
    http.enqueue(problem(429, "api.rate-limited"));

    const result = await api.getAppConfig();

    expect(result.ok).toBe(false);
    expect(http.requests()).toHaveLength(1);
  });
});

describe("the build headers (case 22)", () => {
  test("every request names the build and the platform", async () => {
    const { api, http } = setup({ platform: "android", build: 7 });
    http.enqueue(jsonAnswer(200, CONFIG));

    await api.getAppConfig();

    expect(only(http).headers.get("x-sacou-app-build")).toBe("7");
    expect(only(http).headers.get("x-sacou-app-platform")).toBe("android");
  });

  test("a signed-in request carries them too", async () => {
    const { api, http } = setup({ platform: "ios", build: 12 });
    http.enqueue(jsonAnswer(200, []));

    await api.listMyGroups();

    expect(only(http).headers.get("x-sacou-app-build")).toBe("12");
    expect(only(http).headers.get("x-sacou-app-platform")).toBe("ios");
  });

  test("without a build, neither is sent", async () => {
    const { api, http } = setup({ platform: "android", build: null });
    http.enqueue(jsonAnswer(200, CONFIG));

    await api.getAppConfig();

    expect(only(http).headers.get("x-sacou-app-build")).toBeNull();
    expect(only(http).headers.get("x-sacou-app-platform")).toBeNull();
  });
});

describe("the 426 (case 20)", () => {
  test("is app-outdated, whatever the body, and is not repeated", async () => {
    const { api, http } = setup({ platform: "android", build: 1 });
    http.enqueue(emptyAnswer(426));

    const result = await api.listMyGroups();

    expect(result).toEqual({ ok: false, error: { kind: "app-outdated" } });
    expect(http.requests()).toHaveLength(1);
  });
});
