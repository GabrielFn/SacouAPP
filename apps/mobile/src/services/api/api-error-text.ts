import { apiErrorKindTexts, apiErrorTexts } from "../../strings/api-errors.pt-BR";
import { apiErrorOf, type ApiError } from "./api-error";

/** The text of an error, by `code` for rule errors (D5). A code is never shown as it came. */
export function apiErrorText(error: ApiError): string {
  switch (error.kind) {
    case "problem":
      return apiErrorTexts[error.code];
    case "session-expired":
      return apiErrorKindTexts.sessionExpired;
    case "not-registered":
      return apiErrorKindTexts.notRegistered;
    case "too-large":
      return apiErrorKindTexts.tooLarge;
    case "rate-limited":
      return apiErrorKindTexts.rateLimited;
    case "unavailable":
      return apiErrorKindTexts.unavailable;
    case "offline":
      return apiErrorKindTexts.offline;
    case "unexpected":
      return apiErrorKindTexts.unexpected;
  }
}

/** The text for anything a query or mutation threw: what is not an `ApiFailure` reads as unexpected. */
export function errorTextOf(error: unknown): string {
  const apiError = apiErrorOf(error);
  return apiErrorText(apiError ?? { kind: "unexpected", status: 0 });
}
