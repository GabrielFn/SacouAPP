import { describe, expect, it } from "vitest";

import { firstNameOf, isEmbeddedBrowser } from "./browser";

describe("isEmbeddedBrowser (case 32)", () => {
  it.each([
    "Mozilla/5.0 (Linux; Android 14; SM-A515F Build/UP1A; wv) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 WhatsApp/2.24",
    "Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0",
    "Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]",
  ])("finds the in-app browser in %s", (agent) => {
    expect(isEmbeddedBrowser(agent)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Linux; Android 14; SM-A515F) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  ])("lets the real browser use Google: %s", (agent) => {
    expect(isEmbeddedBrowser(agent)).toBe(false);
  });
});

describe("firstNameOf", () => {
  it("takes the first word, capped in code points", () => {
    expect(firstNameOf("  Ana Maria Souza ", 20)).toBe("Ana");
    expect(firstNameOf("Maximiliano", 4)).toBe("Maxi");
    expect(firstNameOf("😀😀😀", 2)).toBe("😀😀");
  });

  it("is empty without a name", () => {
    expect(firstNameOf(null, 20)).toBe("");
    expect(firstNameOf("   ", 20)).toBe("");
  });
});
