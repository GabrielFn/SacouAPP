import { apiErrorKindTexts, apiErrorTexts } from "../../strings/api-errors.pt-BR";
import { apiErrorOf, type ApiError } from "./api-error";

/** The text of every kind of error that has no `code`: a closed table, so a new kind fails the build. */
const KIND_TEXTS: Readonly<Record<Exclude<ApiError["kind"], "problem">, string>> = {
  "session-expired": apiErrorKindTexts.sessionExpired,
  "not-registered": apiErrorKindTexts.notRegistered,
  "too-large": apiErrorKindTexts.tooLarge,
  "rate-limited": apiErrorKindTexts.rateLimited,
  unavailable: apiErrorKindTexts.unavailable,
  "app-outdated": apiErrorKindTexts.appOutdated,
  offline: apiErrorKindTexts.offline,
  "account-changed": apiErrorKindTexts.accountChanged,
  unexpected: apiErrorKindTexts.unexpected,
};

/** The text of an error, by `code` for rule errors (D5). A code is never shown as it came. */
export function apiErrorText(error: ApiError): string {
  return error.kind === "problem" ? apiErrorTexts[error.code] : KIND_TEXTS[error.kind];
}

/** The text for anything a query or mutation threw: what is not an `ApiFailure` reads as unexpected. */
export function errorTextOf(error: unknown): string {
  const apiError = apiErrorOf(error);
  return apiErrorText(apiError ?? { kind: "unexpected", status: 0 });
}
