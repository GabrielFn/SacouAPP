import { FORMATION_SYSTEMS, OVERLAP_RULE_MODES, type Result } from "@sacou/volley-rules";
import { describe, expect, expectTypeOf, test } from "vitest";

import {
  DEFAULT_FIXED_EXIT_COUNT,
  DEFAULT_QUEUE_EXIT_MODE,
  DEFAULT_WINNER_EXIT_ENABLED,
  DEFAULT_WINNER_EXIT_WINS,
  MAX_WINNER_EXIT_WINS,
  MIN_FIXED_EXIT_COUNT,
  MIN_WINNER_EXIT_WINS,
  QUEUE_EXIT_CRITERION_KEYS,
  QUEUE_EXIT_MODE_KINDS,
} from "../queue/constants.data.js";
import {
  BEST_OF_VALUES,
  MATCH_STARTED_EVENT_TYPE,
  MAX_SET_POINTS,
  MAX_TEAM_MEMBERS,
  MIN_SET_POINTS,
  WIN_MARGIN_VALUES,
} from "../score/constants.data.js";
import { matchInput } from "../score/match-player.test.fixture.js";
import { parseScorePayload } from "../score/parse-payloads.js";
import { applyTemplate, defaultGroupSettings } from "./apply-template.js";
import { SETTINGS_MODALITIES, SETTINGS_PATHS, SETTINGS_TEMPLATE_KEYS } from "./constants.data.js";
import { deriveMatchRules } from "./derive-match-rules.js";
import { checkDisplayText } from "./display-text.js";
import { parseSettingsCatalog } from "./parse-catalog.js";
import { parseLayer } from "./parse-layer.js";
import { parseGroupSettings } from "./parse-settings.js";
import { resolveSettings } from "./resolve-settings.js";
import { getSettingsTemplate, SETTINGS_CATALOG } from "./settings-catalog.js";
import rawCatalog from "./settings-catalog.json" with { type: "json" };
import { editJson, REMOVED } from "./settings-json.test.fixture.js";
import { flattenSettings } from "./settings-tree.js";
import type { SettingsField, SettingsPath } from "./types.js";

/** Technical ceiling of members of a group, the `GroupLimits.MaxActiveMembersPerGroup` of the C#. */
const MAX_ACTIVE_MEMBERS_PER_GROUP = 300;
const VENUE_MAX_LENGTH = 80;
const LONE_SURROGATE = String.fromCharCode(0xd800);

function fieldAt(path: SettingsPath): SettingsField {
  const field = SETTINGS_CATALOG.fields.find((candidate) => candidate.path === path);
  if (field === undefined) {
    throw new Error(path);
  }
  return field;
}

function valueOf<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error("Expected a success.");
  }
  return result.value;
}

describe("settings catalog against the engine (V10)", () => {
  test("lists exactly the typed paths, in order", () => {
    expectTypeOf<(typeof SETTINGS_PATHS)[number]>().toEqualTypeOf<SettingsPath>();
    expect(SETTINGS_CATALOG.fields.map(({ path }) => path)).toStrictEqual(SETTINGS_PATHS);
  });

  test("ranges and lists are the constants of the engine and of the API", () => {
    expect(fieldAt("scoring.bestOf").values).toStrictEqual(BEST_OF_VALUES);
    expect(fieldAt("scoring.winMargin").values).toStrictEqual(WIN_MARGIN_VALUES);
    expect([...fieldAt("rotation.system").values].sort()).toStrictEqual(
      [...FORMATION_SYSTEMS].sort(),
    );
    expect(fieldAt("rotation.ruleMode").values).toStrictEqual(OVERLAP_RULE_MODES);
    expect(fieldAt("queue.exitCriterion").values).toStrictEqual(QUEUE_EXIT_CRITERION_KEYS);
    expect(fieldAt("format.modality").values).toStrictEqual(SETTINGS_MODALITIES);
    ["scoring.pointsPerSet", "scoring.tieBreakPoints"].forEach((path) => {
      expect(fieldAt(path as SettingsPath)).toMatchObject({
        min: MIN_SET_POINTS,
        max: MAX_SET_POINTS,
      });
    });
    expect(fieldAt("attendance.capacity").max).toBe(MAX_ACTIVE_MEMBERS_PER_GROUP);
    expect(fieldAt("schedule.venue").maxLength).toBe(VENUE_MAX_LENGTH);
  });

  test("the queue modes are the constants of the engine (E2.12)", () => {
    expect(fieldAt("queue.exitMode")).toMatchObject({
      defaultValue: DEFAULT_QUEUE_EXIT_MODE,
      values: QUEUE_EXIT_MODE_KINDS,
    });
    expect(fieldAt("queue.fixedExitCount")).toMatchObject({
      defaultValue: DEFAULT_FIXED_EXIT_COUNT,
      max: MAX_TEAM_MEMBERS,
      min: MIN_FIXED_EXIT_COUNT,
    });
    expect(fieldAt("queue.winnerExitEnabled").defaultValue).toBe(DEFAULT_WINNER_EXIT_ENABLED);
    expect(fieldAt("queue.winnerExitWins")).toMatchObject({
      defaultValue: DEFAULT_WINNER_EXIT_WINS,
      max: MAX_WINNER_EXIT_WINS,
      min: MIN_WINNER_EXIT_WINS,
    });
  });

  test("is frozen", () => {
    expect(Object.isFrozen(SETTINGS_CATALOG.fields[0])).toBe(true);
    expect(Object.isFrozen(SETTINGS_CATALOG.templates[0]?.values)).toBe(true);
  });
});

const INTEGER_FIELD = String(rawCatalog.fields.findIndex((field) => field.type === "integer"));

describe("settings catalog parser", () => {
  const fields = rawCatalog.fields;
  test.each([
    [
      "a template that brings a fact",
      ["templates", "pelada", "values", "money.monthlyFeeCents"],
      100,
    ],
    ["a template value out of the list", ["templates", "treino", "values", "scoring.bestOf"], 2],
    ["a template with an unknown path", ["templates", "treino", "values", "scoring.extra"], 2],
    ["a missing template", ["templates", "treino"], REMOVED],
    ["an unknown template", ["templates", "outro"], { pro: false, values: {} }],
    ["an unknown key in a field", ["fields", "0", "extra"], 1],
    ["a missing key in a field", ["fields", "0", "groupFact"], REMOVED],
    ["an integer field without min", ["fields", INTEGER_FIELD, "min"], REMOVED],
    ["an integer field without max", ["fields", INTEGER_FIELD, "max"], REMOVED],
    ["a default its rule refuses", ["fields", "2", "default"], 1],
    ["a Pro value out of the list", ["fields", "21", "proValues"], ["6x0"]],
    ["a field without the group level", ["fields", "0", "levels"], ["round"]],
    [
      "fields out of order",
      ["fields"],
      fields.map((_field, index) => fields[fields.length - 1 - index]),
    ],
    ["another schema version", ["schemaVersion"], 2],
  ])("refuses %s", (_name, keys, value) => {
    expect(() => parseSettingsCatalog(editJson(rawCatalog, keys, value))).toThrow(
      /Invalid settings catalog/,
    );
  });

  test("accepts the real file (positive control)", () => {
    expect(parseSettingsCatalog(editJson(rawCatalog, [], rawCatalog)).fields).toHaveLength(
      SETTINGS_PATHS.length,
    );
  });
});

describe("templates (V11, D4)", () => {
  test("keys are the ones of screen 04 and none brings a fact", () => {
    expect(SETTINGS_CATALOG.templates.map(({ key }) => key)).toStrictEqual(SETTINGS_TEMPLATE_KEYS);
    SETTINGS_CATALOG.templates.forEach((template) => {
      Object.keys(template.values).forEach((path) => {
        expect(fieldAt(path as SettingsPath).groupFact, `${template.key} ${path}`).toBe(false);
      });
    });
  });

  test("every template over Do zero is a valid document", () => {
    SETTINGS_CATALOG.templates.forEach((template) => {
      const applied = applyTemplate(defaultGroupSettings(), template);
      expect(parseGroupSettings(JSON.parse(JSON.stringify(applied))).ok, template.key).toBe(true);
    });
  });

  test("Do zero has every block switched off", () => {
    const values = flattenSettings(
      applyTemplate(defaultGroupSettings(), getSettingsTemplate("do-zero")),
    );
    const switches = SETTINGS_CATALOG.fields.filter(({ leaf }) => leaf === "enabled");
    expect(switches.length).toBeGreaterThan(0);
    switches.forEach(({ path }) => {
      expect(values[path], path).toBe(false);
    });
  });

  test("only Treino is Pro", () => {
    expect(SETTINGS_CATALOG.templates.filter(({ pro }) => pro).map(({ key }) => key)).toStrictEqual(
      ["treino"],
    );
  });
});

describe("derived match rules (N6)", () => {
  test("the frozen scoring passes the MatchStarted parser of the engine", () => {
    const layer = valueOf(
      parseLayer("round", { schemaVersion: 1, scoring: { bestOf: 3, tieBreakEnabled: false } }),
    );
    SETTINGS_CATALOG.templates.forEach((template) => {
      const group = applyTemplate(defaultGroupSettings(), template);
      [undefined, layer].forEach((round) => {
        const { scoring } = deriveMatchRules(resolveSettings(group, round).values);
        const payload = JSON.parse(JSON.stringify(matchInput(scoring))) as unknown;
        expect(parseScorePayload(MATCH_STARTED_EVENT_TYPE, payload).ok, template.key).toBe(true);
      });
    });
  });
});

describe("purity", () => {
  test("results are frozen and the inputs are untouched", () => {
    const group = applyTemplate(defaultGroupSettings(), getSettingsTemplate("pelada"));
    const before = JSON.stringify(group);
    const round = valueOf(parseLayer("round", { schemaVersion: 1, scoring: { bestOf: 3 } }));
    const resolved = resolveSettings(group, round);
    expect(JSON.stringify(group)).toBe(before);
    expect(Object.isFrozen(resolved.values.scoring)).toBe(true);
    expect(Object.isFrozen(resolved.sources)).toBe(true);
    expect(Object.isFrozen(round)).toBe(true);
  });
});

describe("display text", () => {
  test("refuses a lone surrogate, which the C# reader refuses as malformed JSON", () => {
    expect(checkDisplayText(`Quadra ${LONE_SURROGATE}`, VENUE_MAX_LENGTH)).toBe(
      "settings.invalid-text",
    );
  });

  test("counts a code point with marks as one character", () => {
    const accented = `e${String.fromCharCode(0x301)}`.normalize("NFC");
    expect(checkDisplayText(accented.repeat(VENUE_MAX_LENGTH), VENUE_MAX_LENGTH)).toBeNull();
  });
});
