import { describe, expect, test } from "vitest";

import { parseGoogleWebClientId } from "./google-sign-in";
import { parseLegalUrl } from "./legal-links";

describe("parseGoogleWebClientId", () => {
  test("a client ID of Google is used as it is", () => {
    const id = "123456789012-abc123def456.apps.googleusercontent.com";
    expect(parseGoogleWebClientId(id)).toBe(id);
  });

  test.each([undefined, "", "abc", "123-abc.apps.googleusercontent.com.evil", " 1-a.apps.googleusercontent.com"])(
    "%j hides the Google button",
    (raw) => {
      expect(parseGoogleWebClientId(raw)).toBeNull();
    },
  );
});

describe("parseLegalUrl", () => {
  test("an https address is offered", () => {
    expect(parseLegalUrl("https://sacou.app/termos")).toBe("https://sacou.app/termos");
  });

  test.each([undefined, "", "http://sacou.app/termos", "javascript:alert(1)", "https://", "https://a b"])(
    "%j is not offered",
    (raw) => {
      expect(parseLegalUrl(raw)).toBeNull();
    },
  );
});
