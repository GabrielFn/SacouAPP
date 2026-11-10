import { checkDisplayText } from "./display-text.js";
import type { SettingsErrorCode, SettingsField, SettingsValueType } from "./types.js";

type ValueRule = (field: SettingsField, value: unknown) => SettingsErrorCode | null;

/** `HH:mm`, with ASCII digits only. The hour and the minute are checked apart, as a range. */
const TIME_SHAPE = /^([0-9]{2}):([0-9]{2})$/;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkBoolean(_field: SettingsField, value: unknown): SettingsErrorCode | null {
  return typeof value === "boolean" ? null : "settings.wrong-type";
}

/** `25.0` is 25, as JSON.parse reads it: the C# compares through a double too (ADR 0025). */
function checkInteger(field: SettingsField, value: unknown): SettingsErrorCode | null {
  if (!isFiniteNumber(value) || !Number.isInteger(value)) {
    return "settings.wrong-type";
  }
  // The catalog parser requires both bounds; a field without them fails closed, never open.
  if (field.min === null || field.max === null) {
    return "settings.out-of-range";
  }
  return value >= field.min && value <= field.max ? null : "settings.out-of-range";
}

/** The type comes from the list: numbers for `bestOf`, text for the system. */
function checkChoice(field: SettingsField, value: unknown): SettingsErrorCode | null {
  const expectsNumber = typeof field.values[0] === "number";
  const hasType = expectsNumber ? isFiniteNumber(value) : typeof value === "string";
  if (!hasType) {
    return "settings.wrong-type";
  }
  return field.values.includes(value as number | string) ? null : "settings.unknown-value";
}

function checkTime(_field: SettingsField, value: unknown): SettingsErrorCode | null {
  const shape = typeof value === "string" ? TIME_SHAPE.exec(value) : null;
  if (shape === null) {
    return "settings.wrong-type";
  }
  const isInRange = Number(shape[1]) <= LAST_HOUR && Number(shape[2]) <= LAST_MINUTE;
  return isInRange ? null : "settings.out-of-range";
}

function checkText(field: SettingsField, value: unknown): SettingsErrorCode | null {
  return typeof value === "string"
    ? checkDisplayText(value, field.maxLength ?? 0)
    : "settings.wrong-type";
}

const VALUE_RULES: Readonly<Record<SettingsValueType, ValueRule>> = {
  boolean: checkBoolean,
  integer: checkInteger,
  choice: checkChoice,
  time: checkTime,
  text: checkText,
};

/** The refusal for a value of a leaf, or `null` when the field accepts it. */
export function checkValue(field: SettingsField, value: unknown): SettingsErrorCode | null {
  return VALUE_RULES[field.type](field, value);
}
