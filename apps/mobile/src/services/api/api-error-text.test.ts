import { describe, expect, test } from "vitest";

import { apiErrorKindTexts, apiErrorTexts } from "../../strings/api-errors.pt-BR";
import { apiErrorText } from "./api-error-text";

const RATE_LIMITED = "Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.";

describe("apiErrorText of the rate limit (E5.3a, case 17)", () => {
  test("the kind and the code read the same pt-BR text", () => {
    expect(apiErrorText({ kind: "rate-limited", retryAfterMs: 1_000 })).toBe(RATE_LIMITED);
    expect(apiErrorText({ kind: "problem", status: 429, code: "api.rate-limited" })).toBe(
      RATE_LIMITED,
    );
    expect(apiErrorKindTexts.rateLimited).toBe(apiErrorTexts["api.rate-limited"]);
  });
});
