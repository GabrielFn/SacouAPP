import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { applyTemplate, defaultGroupSettings } from "./apply-template.js";
import { deriveMatchRules } from "./derive-match-rules.js";
import { countLayerChanges, normalizeLayer } from "./normalize-layer.js";
import { parseLayer } from "./parse-layer.js";
import { parseGroupSettings } from "./parse-settings.js";
import { resolveSettings } from "./resolve-settings.js";
import { getSettingsTemplate, SETTINGS_CATALOG } from "./settings-catalog.js";
import { EXPECTED_SETTINGS_IDS } from "./settings-golden-ids.test.fixture.js";
import { flattenSettings } from "./settings-tree.js";
import type {
  GroupSettings,
  SettingsLayer,
  SettingsLayerLevel,
  SettingsPath,
  SettingsTemplateKey,
  SettingsValue,
} from "./types.js";

type Json = unknown;
type MutableRecord = Record<string, Json>;

interface GroupSpec {
  readonly template?: SettingsTemplateKey;
  readonly set?: Readonly<Record<string, Json>>;
  readonly remove?: readonly string[];
  readonly raw?: Json;
}

type Expected =
  | { readonly ok: true; readonly layer?: Json }
  | { readonly ok: false; readonly code: string; readonly path: string };

interface BaseCase {
  readonly id: string;
  readonly description: string;
}

interface ResolveCase extends BaseCase {
  readonly kind: "resolve";
  readonly group: GroupSpec;
  readonly round?: Json;
  readonly match?: Json;
  readonly expectedChanges: Readonly<Record<string, SettingsValue>>;
  readonly expectedSources: Readonly<Record<string, string>>;
}

interface NormalizeCase extends BaseCase {
  readonly kind: "normalize";
  readonly group: GroupSpec;
  readonly round?: Json;
  readonly level: SettingsLayerLevel;
  readonly layer: Json;
  readonly expectedLayer: Json;
  readonly expectedChangeCount: number;
}

interface DeriveCase extends BaseCase {
  readonly kind: "derive";
  readonly group: GroupSpec;
  readonly round?: Json;
  readonly match?: Json;
  readonly expected: Json;
}

interface ParseGroupCase extends BaseCase {
  readonly kind: "parse-group";
  readonly document: GroupSpec;
  readonly expected: Expected;
}

interface ParseLayerCase extends BaseCase {
  readonly kind: "parse-layer";
  readonly level: SettingsLayerLevel;
  readonly layer: Json;
  readonly expected: Expected;
}

interface ApplyTemplateCase extends BaseCase {
  readonly kind: "apply-template";
  readonly group: GroupSpec;
  readonly template: SettingsTemplateKey;
  readonly expectedValues: Readonly<Record<string, SettingsValue>>;
}

type GoldenCase =
  | ResolveCase
  | NormalizeCase
  | DeriveCase
  | ParseGroupCase
  | ParseLayerCase
  | ApplyTemplateCase;

const CASES = JSON.parse(
  readFileSync(new URL("../../golden/settings-resolver.json", import.meta.url), "utf8"),
) as readonly GoldenCase[];

const S10_PREFIX = "S10-";

function casesOf<K extends GoldenCase["kind"]>(kind: K): readonly Extract<GoldenCase, { kind: K }>[] {
  return CASES.filter((goldenCase): goldenCase is Extract<GoldenCase, { kind: K }> => goldenCase.kind === kind);
}

/** The raw document a spec describes: a template over "Do zero", then leaves set or removed. */
function rawDocument(spec: GroupSpec): Json {
  if ("raw" in spec) {
    return spec.raw;
  }
  const base = applyTemplate(defaultGroupSettings(), getSettingsTemplate(spec.template ?? "do-zero"));
  const document = JSON.parse(JSON.stringify(base)) as MutableRecord;
  Object.entries(spec.set ?? {}).forEach(([path, value]) => {
    const [block, leaf] = path.split(".");
    if (leaf === undefined) {
      document[path] = value;
      return;
    }
    (document[block ?? ""] as MutableRecord)[leaf] = value;
  });
  (spec.remove ?? []).forEach((path) => {
    const [block, leaf] = path.split(".");
    if (leaf === undefined) {
      delete document[path];
      return;
    }
    delete (document[block ?? ""] as MutableRecord)[leaf];
  });
  return document;
}

function groupOf(spec: GroupSpec): GroupSettings {
  const parsed = parseGroupSettings(rawDocument(spec));
  if (!parsed.ok) {
    throw new Error(`Golden group did not parse: ${parsed.error.code} at ${parsed.error.path}`);
  }
  return parsed.value;
}

function layerOf(level: SettingsLayerLevel, raw: Json): SettingsLayer | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = parseLayer(level, raw);
  if (!parsed.ok) {
    throw new Error(`Golden layer did not parse: ${parsed.error.code} at ${parsed.error.path}`);
  }
  return parsed.value;
}

describe("settings golden: resolve (S) and the normalization property (N2)", () => {
  test.each(casesOf("resolve"))("$id", ({ group, round, match, expectedChanges, expectedSources }) => {
    const groupSettings = groupOf(group);
    const roundLayer = layerOf("round", round);
    const matchLayer = layerOf("match", match);
    const resolved = resolveSettings(groupSettings, roundLayer, matchLayer);
    const groupLeaves = flattenSettings(groupSettings);
    const values = flattenSettings(resolved.values);

    SETTINGS_CATALOG.fields.forEach(({ path }) => {
      expect(values[path], path).toStrictEqual(expectedChanges[path] ?? groupLeaves[path]);
      expect(resolved.sources[path], path).toBe(expectedSources[path] ?? "group");
    });

    const normalizedRound = roundLayer && normalizeLayer(groupSettings, roundLayer);
    const roundValues = resolveSettings(groupSettings, normalizedRound).values;
    const normalizedMatch = matchLayer && normalizeLayer(roundValues, matchLayer);
    expect(resolveSettings(groupSettings, normalizedRound, normalizedMatch).values).toStrictEqual(
      resolved.values,
    );
  });

  test("S10 has one case per leaf and level that takes it, and nothing else", () => {
    const expected = SETTINGS_CATALOG.fields.flatMap((field) =>
      field.levels.filter((level) => level !== "group").map((level) => `${S10_PREFIX}${level}-${field.path}`),
    );
    const inFile = CASES.map(({ id }) => id).filter((id) => id.startsWith(S10_PREFIX));
    expect(inFile).toStrictEqual(expected);
  });

  test("the literal list matches the file", () => {
    const inFile = CASES.map(({ id }) => id).filter((id) => !id.startsWith(S10_PREFIX));
    expect(inFile).toStrictEqual(EXPECTED_SETTINGS_IDS);
  });
});

describe("settings golden: normalize (N1, N3)", () => {
  test.each(casesOf("normalize"))("$id", (goldenCase) => {
    const groupSettings = groupOf(goldenCase.group);
    const parent = resolveSettings(groupSettings, layerOf("round", goldenCase.round)).values;
    const normalized = normalizeLayer(parent, layerOf(goldenCase.level, goldenCase.layer) ?? { schemaVersion: 1 });
    expect(normalized).toStrictEqual(goldenCase.expectedLayer);
    expect(countLayerChanges(normalized)).toBe(goldenCase.expectedChangeCount);
  });
});

describe("settings golden: derive (N4, N5)", () => {
  test.each(casesOf("derive"))("$id", ({ group, round, match, expected }) => {
    const resolved = resolveSettings(groupOf(group), layerOf("round", round), layerOf("match", match));
    expect(deriveMatchRules(resolved.values)).toStrictEqual(expected);
  });
});

describe("settings golden: parse (V)", () => {
  test.each(casesOf("parse-group"))("$id", ({ document, expected }) => {
    const parsed = parseGroupSettings(rawDocument(document));
    expect(parsed.ok ? { ok: true } : { ok: false, ...parsed.error }).toStrictEqual(expected);
  });

  test.each(casesOf("parse-layer"))("$id", ({ level, layer, expected }) => {
    const parsed = parseLayer(level, layer);
    expect(
      parsed.ok ? { ok: true, layer: parsed.value } : { ok: false, ...parsed.error },
    ).toStrictEqual(expected);
  });
});

describe("settings golden: templates (V11)", () => {
  test.each(casesOf("apply-template"))("$id", ({ group, template, expectedValues }) => {
    const applied = applyTemplate(groupOf(group), getSettingsTemplate(template));
    expect(flattenSettings(applied)).toStrictEqual(expectedValues);
    const leaves: readonly SettingsPath[] = SETTINGS_CATALOG.fields.map(({ path }) => path);
    expect(Object.keys(expectedValues)).toStrictEqual(leaves);
  });
});
