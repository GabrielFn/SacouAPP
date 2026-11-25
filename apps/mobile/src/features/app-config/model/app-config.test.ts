import { describe, expect, test } from "vitest";

import type { AppConfig } from "../../../services/api/sacou-api";
import type { AppBuild } from "../app-build";
import {
  APP_BUILD_HEADER,
  APP_PLATFORM_HEADER,
  appBuildHeaders,
  parseNativeBuild,
} from "./app-build-headers";
import { isBelowMinimum, isFeatureOn, updateUrlOf } from "./app-config";

const STORE = "https://play.google.com/store/apps/details?id=com.sacou.app";

function configOf(
  minimum: { android: number; ios: number },
  mvpVote = true,
  updateUrl: { android: string | null; ios: string | null } = { android: STORE, ios: null },
): AppConfig {
  return { minimumBuild: minimum, updateUrl, features: { mvpVote } };
}

const ANDROID_10: AppBuild = { platform: "android", build: 10 };

describe("isBelowMinimum (case 17)", () => {
  test.each([
    [9, 10, true],
    [10, 10, false],
    [11, 10, false],
  ])("build %i against a minimum of %i is %s", (build, minimum, expected) => {
    expect(
      isBelowMinimum({ platform: "android", build }, configOf({ android: minimum, ios: 1 })),
    ).toBe(expected);
  });

  test("a build the binary does not tell is never blocked", () => {
    expect(
      isBelowMinimum({ platform: "android", build: null }, configOf({ android: 99, ios: 99 })),
    ).toBe(false);
  });

  test("without an answer nothing is blocked", () => {
    expect(isBelowMinimum(ANDROID_10, undefined)).toBe(false);
  });

  test("each platform reads its own minimum", () => {
    const config = configOf({ android: 1, ios: 50 });

    expect(isBelowMinimum({ platform: "ios", build: 10 }, config)).toBe(true);
    expect(isBelowMinimum(ANDROID_10, config)).toBe(false);
  });
});

describe("isFeatureOn (case 18)", () => {
  test("without an answer, the default of the catalog: on", () => {
    expect(isFeatureOn(undefined, "mvpVote")).toBe(true);
  });

  test("an explicit false is off, an explicit true is on", () => {
    expect(isFeatureOn(configOf({ android: 1, ios: 1 }, false), "mvpVote")).toBe(false);
    expect(isFeatureOn(configOf({ android: 1, ios: 1 }, true), "mvpVote")).toBe(true);
  });
});

describe("updateUrlOf", () => {
  test("the store page of this platform, only over HTTPS", () => {
    const config = configOf({ android: 1, ios: 1 }, true, { android: STORE, ios: "http://x.test" });

    expect(updateUrlOf(ANDROID_10, config)).toBe(STORE);
    expect(updateUrlOf({ platform: "ios", build: 1 }, config)).toBeNull();
  });

  test("none without a page or without an answer", () => {
    expect(
      updateUrlOf(ANDROID_10, configOf({ android: 1, ios: 1 }, true, { android: null, ios: null })),
    ).toBeNull();
    expect(updateUrlOf(ANDROID_10, undefined)).toBeNull();
  });
});

describe("appBuildHeaders (case 22)", () => {
  test("names the build and the platform", () => {
    expect(appBuildHeaders({ platform: "ios", build: 42 })).toEqual({
      [APP_BUILD_HEADER]: "42",
      [APP_PLATFORM_HEADER]: "ios",
    });
  });

  test("no build, no header", () => {
    expect(appBuildHeaders({ platform: "android", build: null })).toEqual({});
  });
});

describe("parseNativeBuild", () => {
  test.each([
    ["42", 42],
    ["1", 1],
    [null, null],
    ["", null],
    ["1.0.2", null],
    ["abc", null],
    ["-3", null],
    ["12345678901", null],
  ])("%s is %s", (text, expected) => {
    expect(parseNativeBuild(text)).toBe(expected);
  });
});
