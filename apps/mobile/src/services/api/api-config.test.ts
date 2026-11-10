import { describe, expect, test } from "vitest";

import { isApiUrl, parseApiBaseUrl } from "./api-config";

const SECRETISH = "https://u:p@host.example";

describe("parseApiBaseUrl (P7)", () => {
  test.each([
    ["https://api.example", false],
    ["https://api.example:8443", false],
    ["HTTPS://API.example", false],
    ["http://10.0.2.2:5000", true],
    ["http://localhost:5000", true],
    ["http://192.168.0.12:5000", true],
    ["http://172.20.1.1", true],
  ])("accepts %s (development %s)", (raw, isDevelopment) => {
    expect(parseApiBaseUrl(raw, isDevelopment).ok).toBe(true);
  });

  test.each([
    ["http://10.0.2.2:5000", false],
    ["http://api.example", true],
    ["http://8.8.8.8", true],
    ["http://172.32.0.1", true],
    [SECRETISH, true],
    ["https://api.example/", false],
    ["https://api.example/v1", false],
    ["https://api.example?x=1", false],
    ["https://api.example#x", false],
    ["https://api.example:99999", false],
    ["//api.example", false],
    ["ftp://api.example", false],
    ["", false],
    [undefined, false],
  ])("refuses %s (development %s)", (raw, isDevelopment) => {
    expect(parseApiBaseUrl(raw, isDevelopment).ok).toBe(false);
  });

  test("the message names the variable and never the value", () => {
    const result = parseApiBaseUrl(SECRETISH, true);
    expect(result.ok ? "" : result.error.message).toContain("EXPO_PUBLIC_API_URL");
    expect(JSON.stringify(result)).not.toContain("u:p");
  });
});

describe("isApiUrl", () => {
  const base = "https://api.example";

  test.each([
    ["https://api.example/v1/groups", true],
    ["https://api.example.evil/v1", false],
    ["https://api.example@evil/v1", false],
    ["https://evil/https://api.example/v1", false],
    ["https://api.example", false],
  ])("%s is under the origin: %s", (url, expected) => {
    expect(isApiUrl(base, url)).toBe(expected);
  });
});
