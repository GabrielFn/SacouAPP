import { apiErrorKindTexts, apiErrorTexts } from "../../strings/api-errors.pt-BR";
import type { ApiError } from "./api-error";

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
    case "unavailable":
      return apiErrorKindTexts.unavailable;
    case "offline":
      return apiErrorKindTexts.offline;
    case "unexpected":
      return apiErrorKindTexts.unexpected;
  }
}
