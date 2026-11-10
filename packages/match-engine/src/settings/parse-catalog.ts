import {
  PATH_SEPARATOR,
  SETTINGS_LEVELS,
  SETTINGS_PATHS,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_TEMPLATE_KEYS,
  SETTINGS_VALUE_TYPES,
} from "./constants.data.js";
import type {
  SettingsBlock,
  SettingsCatalog,
  SettingsField,
  SettingsTemplate,
  SettingsValue,
} from "./types.js";
import { checkValue } from "./value-rules.js";

type UnknownRecord = Readonly<Record<string, unknown>>;

const COMMON_FIELD_KEYS = ["path", "type", "default", "levels", "groupFact", "pro"];

/** The keys each type adds: anything else in a field is refused. */
const TYPE_FIELD_KEYS: Readonly<Record<string, readonly string[]>> = {
  boolean: [],
  integer: ["min", "max"],
  choice: ["values", "proValues"],
  time: [],
  text: ["maxLength"],
};

const OPTIONAL_FIELD_KEYS: readonly string[] = ["proValues"];

/** A broken catalog is a program error, as in the formations: it throws, it is not a `Result`. */
function fail(path: string, expected: string): never {
  throw new Error(`Invalid settings catalog at "${path}": expected ${expected}.`);
}

function readObject(raw: unknown, path: string, keys: readonly string[]): UnknownRecord {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail(path, "an object");
  }
  const record = raw as UnknownRecord;
  const unknownKey = Object.keys(record).find((key) => !keys.includes(key));
  if (unknownKey !== undefined) {
    return fail(`${path}.${unknownKey}`, `a key among ${keys.join(", ")}`);
  }
  return record;
}

function readArray(raw: unknown, path: string): readonly unknown[] {
  return Array.isArray(raw) ? raw : fail(path, "an array");
}

function readBoolean(raw: unknown, path: string): boolean {
  return typeof raw === "boolean" ? raw : fail(path, "a boolean");
}

function readInteger(raw: unknown, path: string): number {
  return typeof raw === "number" && Number.isSafeInteger(raw) ? raw : fail(path, "an integer");
}

function readMember<T>(allowed: readonly T[], raw: unknown, path: string): T {
  const match = allowed.find((value) => value === raw);
  return match ?? fail(path, `one of ${allowed.join(", ")}`);
}

function readScalar(raw: unknown, path: string): SettingsValue {
  const isScalar = ["boolean", "number", "string"].includes(typeof raw);
  return isScalar ? (raw as SettingsValue) : fail(path, "a boolean, a number or a string");
}

function readScalars(raw: unknown, path: string): readonly SettingsValue[] {
  return readArray(raw ?? [], path).map((item, index) =>
    readScalar(item, `${path}.${String(index)}`),
  );
}

function readField(raw: unknown, index: number): SettingsField {
  const at = `fields.${String(index)}`;
  const type = readMember(
    SETTINGS_VALUE_TYPES,
    (raw as UnknownRecord | null)?.["type"],
    `${at}.type`,
  );
  const record = readObject(raw, at, [...COMMON_FIELD_KEYS, ...(TYPE_FIELD_KEYS[type] ?? [])]);
  const missing = (TYPE_FIELD_KEYS[type] ?? [])
    .concat(COMMON_FIELD_KEYS)
    .find((key) => !OPTIONAL_FIELD_KEYS.includes(key) && !Object.hasOwn(record, key));
  if (missing !== undefined) {
    return fail(`${at}.${missing}`, "a value");
  }
  const path = readMember(SETTINGS_PATHS, record["path"], `${at}.path`);
  if (path !== SETTINGS_PATHS[index]) {
    return fail(`${at}.path`, `"${String(SETTINGS_PATHS[index])}" in this position`);
  }
  const [block, leaf] = path.split(PATH_SEPARATOR) as [SettingsBlock, string];
  const field: SettingsField = {
    path,
    block,
    leaf,
    type,
    defaultValue: readScalar(record["default"], `${at}.default`),
    min: type === "integer" ? readInteger(record["min"], `${at}.min`) : null,
    max: type === "integer" ? readInteger(record["max"], `${at}.max`) : null,
    values: readScalars(record["values"], `${at}.values`),
    maxLength: type === "text" ? readInteger(record["maxLength"], `${at}.maxLength`) : null,
    levels: readArray(record["levels"], `${at}.levels`).map((level, position) =>
      readMember(SETTINGS_LEVELS, level, `${at}.levels.${String(position)}`),
    ),
    groupFact: readBoolean(record["groupFact"], `${at}.groupFact`),
    pro: readBoolean(record["pro"], `${at}.pro`),
    proValues: readScalars(record["proValues"], `${at}.proValues`),
  };
  return checkFieldConsistency(field, at);
}

/** The default passes its own rule, a group accepts every field and Pro values are in the list. */
function checkFieldConsistency(field: SettingsField, at: string): SettingsField {
  if (checkValue(field, field.defaultValue) !== null) {
    return fail(`${at}.default`, "a value its own rule accepts");
  }
  if (field.levels[0] !== "group") {
    return fail(`${at}.levels`, "the group level first");
  }
  if (field.proValues.some((value) => !field.values.includes(value))) {
    return fail(`${at}.proValues`, "values of the list");
  }
  return field;
}

function readTemplate(
  raw: unknown,
  key: SettingsTemplate["key"],
  fields: readonly SettingsField[],
): SettingsTemplate {
  const at = `templates.${key}`;
  const record = readObject(raw, at, ["pro", "values"]);
  const values = readObject(record["values"], `${at}.values`, SETTINGS_PATHS);
  Object.entries(values).forEach(([path, value]) => {
    const field = fields.find((candidate) => candidate.path === path);
    if (field === undefined || field.groupFact || checkValue(field, value) !== null) {
      fail(`${at}.values.${path}`, "a valid value of a field that is not a group fact");
    }
  });
  return {
    key,
    pro: readBoolean(record["pro"], `${at}.pro`),
    values,
  };
}

export function parseSettingsCatalog(raw: unknown): SettingsCatalog {
  const record = readObject(raw, "catalog", ["schemaVersion", "fields", "templates"]);
  const schemaVersion = readMember<typeof SETTINGS_SCHEMA_VERSION>(
    [SETTINGS_SCHEMA_VERSION],
    record["schemaVersion"],
    "schemaVersion",
  );
  const rawFields = readArray(record["fields"], "fields");
  if (rawFields.length !== SETTINGS_PATHS.length) {
    return fail("fields", `${String(SETTINGS_PATHS.length)} fields`);
  }
  const fields = rawFields.map(readField);
  const templates = readObject(record["templates"], "templates", SETTINGS_TEMPLATE_KEYS);
  const templateList = SETTINGS_TEMPLATE_KEYS.map((key) =>
    readTemplate(templates[key], key, fields),
  );
  return { schemaVersion, fields, templates: templateList };
}
