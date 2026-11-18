import { describe, expect, test } from "vitest";

import { apiErrorCodes } from "../../api/generated/error-codes";
import { apiErrorText } from "../api/api-error-text";
import { offlineBannerText } from "./staleness";

const NOW = 10 * 24 * 3_600_000;
const MINUTE = 60_000;

describe("offlineBannerText", () => {
  test.each([
    [30_000, "Sem conexão"],
    [5 * MINUTE, "Sem conexão · atualizado há 5 min"],
    [125 * MINUTE, "Sem conexão · atualizado há 2 h"],
    [25 * 60 * MINUTE, "Sem conexão · atualizado há 1 dia"],
    [3 * 24 * 60 * MINUTE, "Sem conexão · atualizado há 3 dias"],
  ])("%i ms ago", (elapsed, text) => {
    expect(offlineBannerText({ online: false, dataUpdatedAt: NOW - elapsed, now: NOW })).toBe(text);
  });

  test("online, or with nothing kept, there is no strip", () => {
    expect(offlineBannerText({ online: true, dataUpdatedAt: NOW, now: NOW })).toBeNull();
    expect(offlineBannerText({ online: false, dataUpdatedAt: 0, now: NOW })).toBeNull();
  });
});

describe("apiErrorText", () => {
  test("every code has its own text", () => {
    const texts = apiErrorCodes.map((code) => apiErrorText({ kind: "problem", status: 409, code }));
    expect(texts.every((text) => text.length > 0)).toBe(true);
  });

  test("the other kinds have a text, and an unexpected one never shows its status", () => {
    expect(apiErrorText({ kind: "offline" })).toBe("Sem conexão.");
    expect(apiErrorText({ kind: "unexpected", status: 418 })).not.toContain("418");
  });
});
