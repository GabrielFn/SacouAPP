import { opsMetricsOf } from "../ops-page/ops-metrics";
import type { OpsFailure } from "../ops-page/ops-page.types";
import type { OpsApiPort, OpsOutcome } from "../ops-page/ports";
import { retrySeconds } from "../round-page/api-failures";

import { createApiClient, type FetchApiOptions } from "./api-client";

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const DEFAULT_RETRY_SECONDS = 60;

const unavailable: OpsOutcome = { kind: "failed", failure: { kind: "unavailable" } };

function rateLimited(response: Response): OpsOutcome {
  const failure: OpsFailure = {
    kind: "rateLimited",
    retryAfterSeconds: retrySeconds(response.headers.get("Retry-After"), DEFAULT_RETRY_SECONDS),
  };
  return { kind: "failed", failure };
}

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function outcomeOf(response: Response): Promise<OpsOutcome> {
  if (response.ok) {
    const metrics = opsMetricsOf(await bodyOf(response));
    return metrics === null ? unavailable : { kind: "ok", metrics };
  }
  switch (response.status) {
    case HTTP_UNAUTHORIZED:
      return { kind: "signedOut" };
    case HTTP_NOT_FOUND:
      return { kind: "denied" };
    case HTTP_TOO_MANY_REQUESTS:
      return rateLimited(response);
    default:
      return unavailable;
  }
}

/**
 * `GET /v1/ops/metrics` through the shared client (ADR 0085): the ID token in `Authorization`, no cookie, no cache,
 * no query. A 404 is the account off the list; 5xx, a body off its shape and no connection are all "unavailable".
 */
export function createOpsFetchApi(options: FetchApiOptions): OpsApiPort {
  const { call } = createApiClient(options);
  return {
    metrics: async () => {
      const response = await call("GET", "/v1/ops/metrics");
      if (response === "signedOut") return { kind: "signedOut" };
      if (response === "offline") return unavailable;
      return outcomeOf(response);
    },
  };
}
