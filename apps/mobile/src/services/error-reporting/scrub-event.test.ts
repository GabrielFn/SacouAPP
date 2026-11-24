import { describe, expect, test } from "vitest";

import {
  REDACTED,
  REDACTED_ID,
  redactText,
  scrubBreadcrumb,
  scrubEvent,
  scrubUrl,
  type ReportedEvent,
} from "./scrub-event";

const EMAIL = "ana.souza+volei@example.com";
const JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl";
const PIX = "00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6";
const GUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("the text filter of what goes to Sentry (E5.2, ADR 0080, D10)", () => {
  test.each([
    ["an e-mail", `user ${EMAIL} failed`, `user ${REDACTED} failed`],
    ["a bearer token", "header Bearer abc.def.ghi sent", `header ${REDACTED} sent`],
    ["a JWT", `token ${JWT} expired`, `token ${REDACTED} expired`],
    ["a Pix code", `pix ${PIX} copied`, `pix ${REDACTED} copied`],
    [
      "a round code in a link",
      "open https://sacou.app/r/K7fQ2x now",
      "open https://sacou.app/r/{code} now",
    ],
    ["an invite deep link", "open sacou://c/ABC123", "open sacou://c/{code}"],
    [
      "an invite token after the #",
      "open https://sacou.app/c#K7fQ2xLongToken",
      "open https://sacou.app/c",
    ],
    ["a query", "GET https://api.sacou.app/v1/x?email=a now", "GET https://api.sacou.app/v1/x now"],
    ["a member id", `member ${GUID} not found`, `member ${REDACTED_ID} not found`],
  ])("%s becomes filtered", (_, text, expected) => {
    expect(redactText(text)).toBe(expected);
  });

  test("a URL keeps only its route: no query, no fragment, codes and ids replaced", () => {
    expect(scrubUrl(`https://api.sacou.app/v1/groups/${GUID}/rounds?x=1#y`)).toBe(
      `https://api.sacou.app/v1/groups/${REDACTED_ID}/rounds`,
    );
    expect(scrubUrl("https://sacou.app/r/ABC123")).toBe("https://sacou.app/r/{code}");
    expect(scrubUrl("sacou://c/ABC123")).toBe("sacou://c/{code}");
  });

  test("a text without personal data stays as it is", () => {
    expect(redactText("Cannot read property 'x' of undefined")).toBe(
      "Cannot read property 'x' of undefined",
    );
  });
});

const DIRTY_EVENT: ReportedEvent = {
  message: `failed for ${EMAIL}`,
  user: { id: "member-1", email: EMAIL, ip_address: "10.0.0.1", username: "Aninha" },
  server_name: "Phone of Ana",
  extra: { nickname: "Aninha" },
  request: {
    url: "https://sacou.app/r/ABC123?ref=wa",
    method: "GET",
    headers: { Authorization: `Bearer ${JWT}` },
    data: { nickname: "Aninha" },
    cookies: { session: "x" },
    query_string: "ref=wa",
  } as ReportedEvent["request"],
  exception: { values: [{ value: `JWT ${JWT} rejected`, type: "Error" } as never] },
  breadcrumbs: [
    { category: "console", message: `log ${EMAIL}` },
    {
      category: "fetch",
      data: {
        url: `https://api.sacou.app/v1/groups/${GUID}?a=1`,
        method: "GET",
        status_code: 500,
        body: "Aninha",
      },
    },
  ],
  tags: { area: "dev-catalog", "event.origin": "javascript", nickname: "Aninha" },
  contexts: { device: { name: "Celular da Ana", model: "Pixel 8" }, os: { name: "Android" } },
};

describe("the event filter (E5.2, ADR 0080, D10)", () => {
  const scrubbed = scrubEvent(DIRTY_EVENT);
  const json = JSON.stringify(scrubbed);

  test("drops the user, the server name, the extras and everything of the request but the route", () => {
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.server_name).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toEqual({ url: "https://sacou.app/r/{code}", method: "GET" });
  });

  test("filters the message, the exception and the breadcrumbs; console lines are dropped", () => {
    expect(scrubbed.message).toBe(`failed for ${REDACTED}`);
    expect(scrubbed.exception?.values?.[0]?.value).toBe(`JWT ${REDACTED} rejected`);
    expect(scrubbed.breadcrumbs).toEqual([
      {
        category: "fetch",
        message: undefined,
        data: {
          method: "GET",
          status_code: 500,
          url: `https://api.sacou.app/v1/groups/${REDACTED_ID}`,
        },
      },
    ]);
  });

  test("keeps only the allowed tags and never the name of the phone", () => {
    expect(scrubbed.tags).toEqual({ area: "dev-catalog", "event.origin": "javascript" });
    expect(scrubbed.contexts).toEqual({
      device: { name: undefined, model: "Pixel 8" },
      os: { name: "Android" },
    });
  });

  test("nothing personal is left anywhere in the event", () => {
    for (const leak of [
      EMAIL,
      JWT,
      "Aninha",
      "Celular da Ana",
      "Phone of Ana",
      "ABC123",
      "10.0.0.1",
    ]) {
      expect(json).not.toContain(leak);
    }
  });

  test("does not change the original event (immutability)", () => {
    const before = JSON.stringify(DIRTY_EVENT);
    scrubEvent(DIRTY_EVENT);
    expect(JSON.stringify(DIRTY_EVENT)).toBe(before);
  });
});

describe("the breadcrumb filter (E5.2, ADR 0080, D10)", () => {
  test("a console breadcrumb is dropped", () => {
    expect(scrubBreadcrumb({ category: "console", message: "hello" })).toBeNull();
  });

  test("a navigation keeps only the route, never the filled path", () => {
    expect(
      scrubBreadcrumb({
        category: "navigation",
        message: "sacou://c/ABC123",
        data: { from: `/groups/${GUID}`, to: "/r/XYZ987?x=1", params: { nickname: "Aninha" } },
      }),
    ).toEqual({
      category: "navigation",
      message: "sacou://c/{code}",
      data: { from: `/groups/${REDACTED_ID}`, to: "/r/{code}" },
    });
  });

  test("an HTTP breadcrumb has no query and no body", () => {
    expect(
      scrubBreadcrumb({
        category: "xhr",
        message: "x",
        data: { url: "https://api.sacou.app/v1/me?token=1", method: "POST", body: "{}" },
      }),
    ).toEqual({
      category: "xhr",
      message: undefined,
      data: { method: "POST", url: "https://api.sacou.app/v1/me" },
    });
  });

  test("a touch keeps the component names, never the label or the text of the button", () => {
    expect(
      scrubBreadcrumb({
        category: "touch",
        message: "Touch event within element: Remover Aninha",
        data: { path: [{ name: "Button", label: "Remover Aninha" }, { label: "Aninha" }] },
      }),
    ).toEqual({ category: "touch", message: undefined, data: { path: [{ name: "Button" }] } });
  });

  test("any other breadcrumb keeps a filtered message and no data", () => {
    expect(
      scrubBreadcrumb({ category: "app.lifecycle", message: `hi ${EMAIL}`, data: { a: 1 } }),
    ).toEqual({ category: "app.lifecycle", message: `hi ${REDACTED}`, data: undefined });
  });
});
