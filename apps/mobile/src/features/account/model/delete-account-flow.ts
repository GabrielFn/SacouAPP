import type { ApiError } from "../../../services/api/api-error";
import { apiErrorText } from "../../../services/api/api-error-text";
import type { SacouApi } from "../../../services/api/sacou-api";
import type {
  AuthFailure,
  AuthProvider,
  AuthSession,
  Reauthentication,
  SessionIdentity,
} from "../../../services/auth/auth-session";
import type { CourtLogResult } from "../../court/ports/court-event-log";
import type { SessionEnder } from "../../../services/session/end-session";
import { apiErrorTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { authFailureText } from "../../auth/model/auth-failure-text";

const BLOCKED = "identity.deletion-blocked";
const RECENT_LOGIN = "identity.recent-login-required";

/** How a tap on "Excluir minha conta" ended. Never a personal datum: kinds and codes only. */
export type DeletionOutcome =
  | { readonly kind: "deleted" }
  /** Someone changed a role meanwhile: the blockers are read again (409, ADR 0056, D7). */
  | { readonly kind: "blocked" }
  /** An e-mail account: the screen asks for the password and the next tap reauthenticates. */
  | { readonly kind: "reauth-required"; readonly error: ApiError }
  | { readonly kind: "reauth-failed"; readonly failure: AuthFailure }
  | { readonly kind: "failed"; readonly error: ApiError };

/**
 * The court sessions of the deleted account leave the device (E6.8): the real one is the
 * `CourtEventLog`, the fake one `createFakeCourtEventLog`.
 */
export interface CourtAccountForget {
  forgetSessionsOf(ownerKey: string): Promise<CourtLogResult<number>>;
}

export interface DeletionDeps {
  readonly api: Pick<SacouApi, "deleteMyAccount">;
  readonly auth: Pick<AuthSession, "reauthenticate" | "currentSession" | "accountKeyOf">;
  readonly ender: Pick<SessionEnder, "endDeleted">;
  readonly court: CourtAccountForget;
  readonly refreshBlockers: () => Promise<void>;
}

export interface DeletionRequest {
  readonly provider: AuthProvider;
  /** The password typed after an e-mail account was asked for it; `null` on the first tap. */
  readonly password: string | null;
}

function isProblem(error: ApiError, code: string): boolean {
  return error.kind === "problem" && error.code === code;
}

/**
 * After the 204 and before the session ends, while the identity is still the deleted one (E6.8). The
 * key of the account that asked, never of one signed in meanwhile; an unknown key forgets nothing.
 * Never blocks the deletion: the account is already gone on the server, so a failure is dropped,
 * without a log (the key and the count are personal enough to keep out of it).
 */
async function forgetCourtSessions(deps: DeletionDeps, session: SessionIdentity): Promise<void> {
  try {
    const ownerKey = await deps.auth.accountKeyOf(session);
    if (ownerKey !== null) await deps.court.forgetSessionsOf(ownerKey);
  } catch {
    // Dropped on purpose: see above.
  }
}

async function attemptDeletion(deps: DeletionDeps): Promise<DeletionOutcome> {
  // Read before the call: only the account that asked for the deletion leaves Firebase.
  const session = deps.auth.currentSession();
  const result = await deps.api.deleteMyAccount();
  if (result.ok) {
    if (session !== null) {
      await forgetCourtSessions(deps, session);
      await deps.ender.endDeleted(session);
    }
    return { kind: "deleted" };
  }
  if (isProblem(result.error, BLOCKED)) {
    await deps.refreshBlockers();
    return { kind: "blocked" };
  }
  if (isProblem(result.error, RECENT_LOGIN))
    return { kind: "reauth-required", error: result.error };
  return { kind: "failed", error: result.error };
}

/** One new login and one more try: a second refusal is shown, never a loop (E4.3, D9). */
async function reauthenticateAndDelete(
  deps: DeletionDeps,
  proof: Reauthentication,
): Promise<DeletionOutcome> {
  const login = await deps.auth.reauthenticate(proof);
  if (!login.ok) return { kind: "reauth-failed", failure: login.error };
  const retried = await attemptDeletion(deps);
  return retried.kind === "reauth-required" ? { kind: "failed", error: retried.error } : retried;
}

/**
 * `DELETE /v1/me`; on 204 the session ends as `deleted` (the Firebase user goes too). The API asks for a
 * login of the last 5 minutes (ADR 0056, D4): Google opens the picker again by itself; an e-mail account
 * answers `reauth-required`, and the screen sends the password on the next tap.
 */
export async function deleteAccount(
  deps: DeletionDeps,
  request: DeletionRequest,
): Promise<DeletionOutcome> {
  if (request.password !== null) {
    return reauthenticateAndDelete(deps, { provider: "password", password: request.password });
  }
  const first = await attemptDeletion(deps);
  if (first.kind !== "reauth-required" || request.provider === "password") return first;
  return reauthenticateAndDelete(deps, { provider: request.provider });
}

/** Whether the screen shows the password field: an e-mail account asked to log in again. */
export function asksForPassword(
  provider: AuthProvider,
  outcome: DeletionOutcome | undefined,
): boolean {
  if (provider !== "password" || outcome === undefined) return false;
  return (
    outcome.kind === "reauth-required" ||
    (outcome.kind === "reauth-failed" && outcome.failure !== "cancelled")
  );
}

/** The text under the button; `null` when there is nothing to say (deleted, a cancelled picker). */
export function deletionOutcomeText(outcome: DeletionOutcome | undefined): string | null {
  if (outcome === undefined) return null;
  switch (outcome.kind) {
    case "deleted":
      return null;
    case "blocked":
      return apiErrorTexts[BLOCKED];
    case "reauth-required":
      return strings.account.deleteScreen.passwordHelp;
    case "reauth-failed":
      return authFailureText(outcome.failure);
    case "failed":
      return apiErrorText(outcome.error);
  }
}
