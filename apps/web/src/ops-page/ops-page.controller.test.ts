import { describe, expect, it } from "vitest";

import { createOpsFetchApi } from "../adapters/ops-fetch-api";
import { opsView } from "../dom/ops-view";

import { createOpsPage } from "./ops-page.controller";
import { fakeAuth, json, metricsBody } from "./ops-page.fixtures.test";
import type { OpsPageState } from "./ops-page.types";

type Answer = () => Promise<Response>;

/** The page with Firebase and `fetch` in memory; every request is recorded with its options. */
function setUp(answers: Answer[], options: { signedIn?: boolean } = {}) {
  const log: string[] = [];
  const requests: { readonly url: string; readonly init: RequestInit }[] = [];
  const states: OpsPageState[] = [];
  const auth = fakeAuth((event) => log.push(event), {
    user: options.signedIn === true ? { displayName: "Gabriel" } : null,
  });
  const page = createOpsPage({
    auth,
    api: createOpsFetchApi({
      fetch: (url, init) => {
        requests.push({ url, init });
        const next = answers.shift();
        return next === undefined ? Promise.reject(new Error("no answer")) : next();
      },
      idToken: () => auth.idToken(),
    }),
    onChange: (state) => states.push(state),
  });
  return { page, log, requests, states };
}

const ok: Answer = () => Promise.resolve(json(200, metricsBody()));

describe("ops page", () => {
  it("criterion 2: without a session it opens the sheet and never asks the API", async () => {
    const { page, requests } = setUp([ok]);

    await page.start();

    expect(page.state()).toEqual({ step: "signIn", form: "choice", failure: null, notice: null });
    expect(requests).toHaveLength(0);
  });

  it("criteria 3 and 6: after the login it asks GET /v1/ops/metrics with the token and no cookie", async () => {
    const { page, requests } = setUp([ok]);
    await page.start();

    await page.signInWithGoogle();

    expect(page.state().step).toBe("ready");
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe("/v1/ops/metrics");
    expect(request?.init.method).toBe("GET");
    expect(request?.init.credentials).toBe("omit");
    expect(request?.init.headers).toMatchObject({ Authorization: "Bearer id-token" });
  });

  it("criterion 12: while the answer has not come it says Carregando… and shows no number", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending: Answer = () => new Promise((resolve) => (release = resolve));
    const { page, states } = setUp([pending], { signedIn: true });

    const started = page.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(page.state().step).toBe("loading");
    expect(opsView(page.state()).status).toBe("Carregando…");
    expect(opsView(page.state()).sections).toHaveLength(0);
    release(json(200, metricsBody()));
    await started;
    expect(states.map((state) => state.step)).toEqual(["loading", "ready"]);
  });

  it("criterion 10: a 404 is the account off the list, with Sair and no number", async () => {
    const { page } = setUp([() => Promise.resolve(json(404, { status: 404 }))], { signedIn: true });

    await page.start();

    const view = opsView(page.state());
    expect(page.state().step).toBe("denied");
    expect(view.status).toBe("Esta conta não tem acesso ao painel.");
    expect(view.signOut).toBe(true);
    expect(view.sections).toHaveLength(0);
    expect(view.reload).toBeNull();
  });

  it("criterion 11: a 429 says the seconds of Retry-After", async () => {
    const limited: Answer = () => Promise.resolve(json(429, {}, { "Retry-After": "42" }));
    const { page } = setUp([limited], { signedIn: true });

    await page.start();

    expect(opsView(page.state()).status).toBe(
      "Muitas atualizações seguidas. Tente de novo em 42 s.",
    );
    expect(opsView(page.state()).reload).toBe("Tentar de novo");
  });

  it.each([
    ["a 503", () => Promise.resolve(json(503, {}))],
    ["a 500", () => Promise.resolve(json(500, {}))],
    ["no connection", () => Promise.reject(new TypeError("offline"))],
    ["a body off its shape", () => Promise.resolve(json(200, metricsBody({ environment: "x" })))],
  ] as const)(
    "criterion 11: %s is Não foi possível carregar, and Tentar de novo asks again",
    async (_, failure) => {
      const { page, requests } = setUp([failure, ok], { signedIn: true });
      await page.start();

      expect(opsView(page.state()).status).toBe("Não foi possível carregar o painel.");
      await page.reload();

      expect(requests).toHaveLength(2);
      expect(page.state().step).toBe("ready");
    },
  );

  it("a 401 leaves the Firebase session and opens the sheet", async () => {
    const { page, log } = setUp([() => Promise.resolve(json(401, {}))], { signedIn: true });

    await page.start();

    expect(log).toContain("signOut");
    expect(page.state()).toMatchObject({ step: "signIn", form: "choice" });
  });

  it("criterion 8: Atualizar asks again and shows what came", async () => {
    const { page, requests } = setUp([ok, ok], { signedIn: true });
    await page.start();

    await page.reload();

    expect(requests).toHaveLength(2);
    expect(opsView(page.state()).updated).toBe("Teste · Atualizado às 15:04");
  });

  it("criterion 9: Sair leaves Firebase and goes back to the sheet without numbers", async () => {
    const { page, log } = setUp([ok], { signedIn: true });
    await page.start();

    await page.signOut();

    expect(log).toContain("signOut");
    expect(page.state()).toMatchObject({ step: "signIn", form: "choice" });
    expect(opsView(page.state()).sections).toHaveLength(0);
    expect(opsView(page.state()).updated).toBeNull();
  });

  it("criterion 12: an answer that comes after Sair never shows, not even on the next account's load", async () => {
    let releaseOld: (response: Response) => void = () => undefined;
    const old: Answer = () => new Promise((resolve) => (releaseOld = resolve));
    const { page } = setUp([old, () => new Promise(() => undefined)], { signedIn: true });
    const firstLoad = page.start();
    await Promise.resolve();
    await Promise.resolve();

    await page.signOut();
    void page.signInWithGoogle();
    await Promise.resolve();
    releaseOld(json(200, metricsBody()));
    await firstLoad;

    expect(page.state().step).toBe("loading");
    expect(opsView(page.state()).sections).toHaveLength(0);
  });
});
