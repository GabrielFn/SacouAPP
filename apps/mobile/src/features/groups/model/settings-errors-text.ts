import { SETTINGS_CATALOG, type SettingsError } from "@sacou/match-engine";

import { settingsStrings } from "../../../strings/settings.pt-BR";

const { errors } = settingsStrings;

/**
 * The text of a refusal of `parseGroupSettings`, by `code` and `path`. The range comes from the catalog,
 * so the app has no rule of its own (the server has the last word).
 */
export function settingsErrorText(error: SettingsError): string {
  const field = SETTINGS_CATALOG.fields.find((candidate) => candidate.path === error.path);
  if (error.code === "settings.out-of-range" && field !== undefined) {
    if (field.min !== null && field.max !== null) return errors.range(field.min, field.max);
    if (field.maxLength !== null) return errors.tooLong(field.maxLength);
  }
  return errors.byCode[error.code];
}
