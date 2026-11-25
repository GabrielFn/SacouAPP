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

export interface OpsGroups {
  readonly total: number;
  readonly active: number;
}

export interface OpsRoundWeek {
  readonly weekStart: string;
  readonly created: number;
}

export interface OpsRounds {
  readonly created: number;
  readonly held: number;
  readonly closed: number;
  readonly canceled: number;
  readonly weeks: readonly OpsRoundWeek[];
}

/** The answers of some rounds held: the rates are `0..1`, or null when there was no confirmed (shown as "—"). */
export interface OpsGateCount {
  readonly rounds: number;
  readonly confirmed: number;
  readonly selfAnswered: number;
  readonly byLink: number;
  readonly rate: number | null;
  readonly linkRate: number | null;
}

export interface OpsGateWeek {
  readonly weekStart: string;
  readonly count: OpsGateCount;
}

/** One group of the gate, with its name (question 216): written with `textContent`, like every text. */
export interface OpsGateGroup {
  readonly name: string;
  readonly count: OpsGateCount;
  readonly longestStreak: number;
  readonly meetsGate: boolean;
}

/** The gate of phase 2 (question 215), as the API computed it: the page compares nothing. */
export interface OpsGate {
  readonly target: number;
  readonly requiredWeeks: number;
  readonly groupsGoal: number;
  readonly groupsMeeting: number;
  readonly total: OpsGateCount;
  readonly weeks: readonly OpsGateWeek[];
  readonly byGroup: readonly OpsGateGroup[];
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
  readonly groups: OpsGroups;
  readonly rounds: OpsRounds;
  readonly gate: OpsGate;
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
