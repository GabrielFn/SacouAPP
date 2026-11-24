import { describe, expect, test } from "vitest";

import { httpsOrigin, type LegalLinkInputs, resolveLegalLinks } from "./legal-links";

const BASE = "https://sacou-api-abc.a.run.app";
const NONE: LegalLinkInputs = { termsUrl: undefined, privacyUrl: undefined, inviteBaseUrl: undefined };

describe("resolveLegalLinks (E6.1)", () => {
  test("explicit https addresses win over the derived ones", () => {
    expect(
      resolveLegalLinks({
        termsUrl: "https://sacou.app/termos-v1",
        privacyUrl: "https://sacou.app/privacidade-v1",
        inviteBaseUrl: BASE,
      }),
    ).toEqual({ terms: "https://sacou.app/termos-v1", privacy: "https://sacou.app/privacidade-v1" });
  });

  test.each([BASE, `${BASE}/`])("without them, the pages of the invite origin %j, no double slash", (base) => {
    expect(resolveLegalLinks({ ...NONE, inviteBaseUrl: base })).toEqual({
      terms: `${BASE}/termos`,
      privacy: `${BASE}/privacidade`,
    });
  });

  test("an explicit link for one document only: the other is derived", () => {
    expect(
      resolveLegalLinks({ ...NONE, termsUrl: "https://sacou.app/t", inviteBaseUrl: BASE }),
    ).toEqual({ terms: "https://sacou.app/t", privacy: `${BASE}/privacidade` });
  });

  test("a base with a path, a query or a fragment: only its origin is used", () => {
    expect(resolveLegalLinks({ ...NONE, inviteBaseUrl: "https://X.run.app/c?y=1#z" })).toEqual({
      terms: "https://x.run.app/termos",
      privacy: "https://x.run.app/privacidade",
    });
  });

  test.each([
    undefined,
    "",
    "http://sacou.app",
    "javascript:alert(1)",
    "https://",
    "https://a b",
    "https://sacou.app/c x",
    "lixo",
    42,
  ])("%j in every input leaves both phrases without a link", (raw) => {
    expect(resolveLegalLinks({ termsUrl: raw, privacyUrl: raw, inviteBaseUrl: raw })).toEqual({
      terms: null,
      privacy: null,
    });
  });

  test("a bad explicit address falls back to the derived page, never to the bad one", () => {
    expect(
      resolveLegalLinks({ termsUrl: "javascript:alert(1)", privacyUrl: "http://x", inviteBaseUrl: BASE }),
    ).toEqual({ terms: `${BASE}/termos`, privacy: `${BASE}/privacidade` });
  });
});

describe("httpsOrigin", () => {
  test("keeps the port and drops the rest", () => {
    expect(httpsOrigin("https://sacou.test:8443/r/abc")).toBe("https://sacou.test:8443");
  });

  test.each(["https://evil.com@sacou.app", "https://sacou.app.", "ftp://sacou.app"])("%j has no origin", (raw) => {
    expect(httpsOrigin(raw)).toBeNull();
  });
});
