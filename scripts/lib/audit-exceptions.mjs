// Shared format of the audit exception lists: advisory, reason and expires (YYYY-MM-DD).
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isValidException(exception) {
  return (
    isNonEmptyString(exception?.advisory) &&
    isNonEmptyString(exception.reason) &&
    isNonEmptyString(exception.expires) &&
    ISO_DATE.test(exception.expires)
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

/** Returns the exceptions, or undefined when the file is malformed. */
export function parseExceptions(raw) {
  const exceptions = parseJson(raw);
  return Array.isArray(exceptions) && exceptions.every(isValidException) ? exceptions : undefined;
}
