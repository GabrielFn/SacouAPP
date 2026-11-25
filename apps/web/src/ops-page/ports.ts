import type { OpsFailure, OpsMetrics } from "./ops-page.types";

/** What one request for the counts ended in, as the page tells it. */
export type OpsOutcome =
  | { readonly kind: "ok"; readonly metrics: OpsMetrics }
  /** 404: the account is not on the operators' list. */
  | { readonly kind: "denied" }
  /** 401, or no session to sign the request with. */
  | { readonly kind: "signedOut" }
  | { readonly kind: "failed"; readonly failure: OpsFailure };

/** `GET /v1/ops/metrics`, same origin, with the caller's ID token (ADR 0085). */
export interface OpsApiPort {
  metrics(): Promise<OpsOutcome>;
}
