import type { Failure, Notice, SheetForm, SignInAttempt } from "../round-page/round-page.types";

/** One week of the users' section: its Monday (`YYYY-MM-DD`), the new accounts and the erased ones. */
export interface OpsUserWeek {
  readonly weekStart: string;
  readonly registered: number;
  readonly deleted: number;
}

export interface OpsUsers {
  readonly registered: number;
  readonly deleted: number;
  readonly weeks: readonly OpsUserWeek[];
}

/** The environment the API runs in: the page writes "Teste" or "Produção". */
export type OpsEnvironment = "test" | "production";

/**
 * What `GET /v1/ops/metrics` answers (E7.2, ADR 0085): only counts, rates, instants and week dates. The page draws
 * them as they come; nothing is counted here.
 */
export interface OpsMetrics {
  readonly environment: OpsEnvironment;
  readonly generatedAt: string;
  readonly users: OpsUsers;
}

/** Why the counts did not come: too many refreshes (with the seconds to wait), or the API or the network failed. */
export type OpsFailure =
  | { readonly kind: "rateLimited"; readonly retryAfterSeconds: number }
  | { readonly kind: "unavailable" };

/**
 * The dashboard's flow: `starting → signIn → signingIn → loading → ready`, or `denied` for an account off the list
 * and `failed` when the counts did not come. Only `ready` holds numbers, so no other step can show them.
 */
export type OpsPageState =
  | { readonly step: "starting" }
  | {
      readonly step: "signIn";
      /** The open form of the sheet; null when the person closed it (the "ENTRAR" button opens it again). */
      readonly form: SheetForm | null;
      readonly failure: Failure | null;
      readonly notice: Notice | null;
    }
  | { readonly step: "signingIn"; readonly attempt: SignInAttempt }
  | { readonly step: "loading" }
  | { readonly step: "ready"; readonly metrics: OpsMetrics }
  | { readonly step: "denied" }
  | { readonly step: "failed"; readonly failure: OpsFailure };

export type OpsStep = OpsPageState["step"];
