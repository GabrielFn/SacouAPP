import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { strings } from "../strings/pt-BR";
import { contrastRatio } from "./contrast";
import { createScaledTokens } from "./scale";
import { accessibilityFloors, palette } from "./tokens.data";

const WIDTHS = [320, 390, 430] as const;
const AA_TEXT = 4.5;

describe("the card share screen touch targets", () => {
  test.each(WIDTHS)("at %i the tiles, buttons and switch are at least 44", (width) => {
    const { sizes } = createScaledTokens({ windowWidth: width, fontScale: 1 });
    for (const target of [
      sizes.systemButton,
      sizes.primaryButton,
      sizes.iconButton,
      sizes.switchTarget,
      sizes.switchTargetWidth,
    ]) {
      expect(target).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
    }
  });

  test.each(WIDTHS)("at %i the card share keeps its tokens at a large font scale", (width) => {
    const tokens = createScaledTokens({ windowWidth: width, fontScale: 2 });
    expect(tokens.sizes.systemButton).toBeGreaterThanOrEqual(accessibilityFloors.touchTarget);
  });
});

describe("the card share screen colors reach AA", () => {
  test.each([
    ["title and labels on the surface", palette.night, palette.white],
    ["caption on the sand page", palette.textSecondary, palette.sand],
  ])("%s", (_name, foreground, background) => {
    const result = contrastRatio(foreground, background);
    expect(result.ok && result.value).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("the card share texts", () => {
  const { cardShare } = strings.profile;
  const texts = [
    ...Object.values(cardShare.failures),
    ...Object.entries(cardShare)
      .filter(([key]) => key !== "failures")
      .map(([, value]) => value as string),
  ];

  test("every text is filled and written in Portuguese, with no level wording", () => {
    for (const text of texts) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\b(share|save|error|failed|permission)\b/i);
      expect(text).not.toMatch(/bronze|prata|ouro|elite|nível/i);
    }
  });

  test("the denied-permission text points to the settings", () => {
    expect(cardShare.failures["permission-denied"]).toMatch(/ajustes/i);
  });
});

describe("the Android manifest of the gallery save", () => {
  const config = JSON.parse(readFileSync(join(__dirname, "..", "..", "app.json"), "utf8")) as {
    expo: {
      plugins: unknown[];
      android: { blockedPermissions: string[] };
    };
  };
  const plugin = config.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === "expo-media-library",
  ) as [string, { granularPermissions: string[] }] | undefined;

  test("asks for no granular media permission", () => {
    expect(plugin?.[1].granularPermissions).toEqual([]);
  });

  test.each([
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
    "READ_MEDIA_IMAGES",
    "READ_MEDIA_VIDEO",
    "READ_MEDIA_AUDIO",
    "READ_MEDIA_VISUAL_USER_SELECTED",
  ])("blocks %s", (name) => {
    expect(config.expo.android.blockedPermissions).toContain(`android.permission.${name}`);
  });
});
