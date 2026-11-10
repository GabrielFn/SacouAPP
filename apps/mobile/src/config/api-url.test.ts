import { describe, expect, test } from "vitest";

import { readApiBaseUrl } from "./api-url";

describe("readApiBaseUrl", () => {
  test("a build without the variable has no API", () => {
    expect(readApiBaseUrl(undefined, false)).toBeNull();
    expect(readApiBaseUrl("", false)).toBeNull();
  });

  test("a valid origin is used as it is", () => {
    expect(readApiBaseUrl("https://api.example", false)).toBe("https://api.example");
  });

  test("a wrong value stops the app, naming the variable and not the value", () => {
    expect(() => readApiBaseUrl("http://api.example.internal", false)).toThrow(
      /^EXPO_PUBLIC_API_URL/,
    );
    expect(() => readApiBaseUrl("http://api.example.internal", false)).not.toThrow(/internal/);
  });
});
