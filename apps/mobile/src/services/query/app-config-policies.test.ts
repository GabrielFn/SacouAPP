import { describe, expect, test } from "vitest";

import { ApiFailure } from "../api/api-error";
import { classifyFailure } from "../api/api-policy";
import { appOutdatedEffects } from "./invalidation";
import { isPersistedKey } from "./persist-policy";
import { queryKeys } from "./query-keys";
import { shouldRetryQuery } from "./retry-policy";

const NOW = 0;

describe("the 426 of the minimum build (case 20)", () => {
  test("is app-outdated by its status, with or without a body", () => {
    const raw = { status: 426, contentType: null, retryAfter: null, body: undefined };

    expect(classifyFailure(raw, NOW)).toEqual({ kind: "app-outdated" });
    expect(
      classifyFailure(
        {
          ...raw,
          contentType: "application/problem+json",
          body: { code: "api.app-outdated" },
        },
        NOW,
      ),
    ).toEqual({ kind: "app-outdated" });
  });

  test("a query is never repeated on it", () => {
    expect(shouldRetryQuery(0, new ApiFailure({ kind: "app-outdated" }))).toBe(false);
  });

  test("any failed call reads the app config again, queries and mutations alike", () => {
    const effects = appOutdatedEffects(new ApiFailure({ kind: "app-outdated" }));

    expect(effects).toEqual([{ action: "invalidate", key: queryKeys.appConfig() }]);
  });

  test("another failure touches nothing", () => {
    expect(appOutdatedEffects(new ApiFailure({ kind: "offline" }))).toEqual([]);
    expect(appOutdatedEffects(new Error("x"))).toEqual([]);
  });
});

describe("the persisted app config", () => {
  test("only the one key is kept on disk, so a known answer holds offline", () => {
    expect(isPersistedKey(queryKeys.appConfig())).toBe(true);
    expect(isPersistedKey(["app-config", "other"])).toBe(false);
  });
});
