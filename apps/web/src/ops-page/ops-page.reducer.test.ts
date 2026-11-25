import { describe, expect, it } from "vitest";

import { opsMetricsOf } from "./ops-metrics";
import { metricsBody } from "./ops-page.fixtures.test";
import type { OpsPageAction } from "./ops-page.actions";
import { initialOpsPageState, opsPageReducer } from "./ops-page.reducer";
import type { OpsMetrics, OpsPageState } from "./ops-page.types";

const metrics = opsMetricsOf(metricsBody()) as OpsMetrics;

function run(...actions: OpsPageAction[]): OpsPageState {
  return actions.reduce(opsPageReducer, initialOpsPageState);
}

describe("ops page reducer", () => {
  it("goes from the session straight to loading, or to the sheet", () => {
    expect(run({ type: "sessionChecked", signedIn: true })).toEqual({ step: "loading" });
    expect(run({ type: "sessionChecked", signedIn: false })).toMatchObject({
      step: "signIn",
      form: "choice",
    });
  });

  it("closes the sheet and opens it again with ENTRAR", () => {
    const closed = run({ type: "sessionChecked", signedIn: false }, { type: "sheetClosed" });
    expect(closed).toMatchObject({ step: "signIn", form: null });
    expect(opsPageReducer(closed, { type: "signInTapped" })).toMatchObject({ form: "choice" });
  });

  it("keeps the numbers only in ready", () => {
    const ready = run({ type: "sessionChecked", signedIn: true }, { type: "loaded", metrics });
    expect(ready).toEqual({ step: "ready", metrics });
    expect(opsPageReducer(ready, { type: "reloadTapped" })).toEqual({ step: "loading" });
    expect(opsPageReducer(ready, { type: "signedOut" })).toMatchObject({ step: "signIn" });
  });

  it("ignores a late answer outside loading", () => {
    const signIn = run({ type: "sessionChecked", signedIn: false });
    expect(opsPageReducer(signIn, { type: "loaded", metrics })).toBe(signIn);
    const denied = run({ type: "sessionChecked", signedIn: true }, { type: "denied" });
    expect(opsPageReducer(denied, { type: "loaded", metrics })).toBe(denied);
    expect(opsPageReducer(denied, { type: "reloadTapped" })).toBe(denied);
  });

  it("goes back to the sheet on a 401, and to failed on the rest", () => {
    const loading = run({ type: "sessionChecked", signedIn: true });
    expect(opsPageReducer(loading, { type: "unauthorized" })).toMatchObject({
      step: "signIn",
      form: "choice",
    });
    expect(
      opsPageReducer(loading, { type: "loadFailed", failure: { kind: "unavailable" } }),
    ).toEqual({
      step: "failed",
      failure: { kind: "unavailable" },
    });
  });
});

describe("ops metrics body", () => {
  it("reads the API's body", () => {
    expect(metrics.environment).toBe("test");
    expect(metrics.users.weeks).toHaveLength(8);
  });

  it.each([
    ["a negative count", { users: { registered: -1, deleted: 0, weeks: [] } }],
    ["a fraction", { users: { registered: 1.5, deleted: 0, weeks: [] } }],
    [
      "a week off its date",
      {
        users: {
          registered: 1,
          deleted: 0,
          weeks: [{ weekStart: "23/11", registered: 0, deleted: 0 }],
        },
      },
    ],
    ["an unknown environment", { environment: "staging" }],
    ["no instant", { generatedAt: "ontem" }],
  ])("refuses %s", (_, overrides) => {
    expect(opsMetricsOf(metricsBody(overrides))).toBeNull();
  });
});
