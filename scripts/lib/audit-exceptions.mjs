// Shared format of the dated exception lists: an identifying field, reason and expires (YYYY-MM-DD).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/** True for a real calendar day written as YYYY-MM-DD (2026-02-30 is rejected). */
export function isCalendarDate(value) {
  if (!isNonEmptyString(value) || !ISO_DATE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, ISO_DATE_LENGTH) === value
  );
}

function hasDatedFields(entry, keyField) {
  return (
    isNonEmptyString(entry?.[keyField]) &&
    isNonEmptyString(entry.reason) &&
    isCalendarDate(entry.expires)
  );
}

/** Returns undefined when the text is not JSON. */
export function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Returns the entries, or undefined when any lacks `keyField`, reason or a valid expires. */
export function parseDatedEntries(raw, keyField, isValidExtra = () => true) {
  const entries = parseJson(raw);
  const valid = (entry) => hasDatedFields(entry, keyField) && isValidExtra(entry);
  return Array.isArray(entries) && entries.every(valid) ? entries : undefined;
}

/** Returns the audit exceptions, or undefined when the file is malformed. */
export function parseExceptions(raw) {
  return parseDatedEntries(raw, "advisory");
}
