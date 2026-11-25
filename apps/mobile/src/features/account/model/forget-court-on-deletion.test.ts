import { afterEach, describe, expect, test, vi } from "vitest";

import { createFakeAuthSession, fakeSessionIdentity } from "../../../adapters/fake-auth-session";
import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createFakeErrorReporter } from "../../../adapters/fake-error-reporter";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { AuthProvider, SessionIdentity } from "../../../services/auth/auth-session";
import type { CourtLogResult } from "../../court/ports/court-event-log";
import {
  deleteAccount,
  deletionOutcomeText,
  type CourtAccountForget,
  type DeletionDeps,
} from "./delete-account-flow";

const BLOCKED: ApiError = { kind: "problem", status: 409, code: "identity.deletion-blocked" };
const RECENT: ApiError = { kind: "problem", status: 403, code: "identity.recent-login-required" };
const SESSION_OF_A = "c0000000-0000-4000-8000-0000000000a1";
const SESSION_OF_B = "c0000000-0000-4000-8000-0000000000b1";
const ROUND = {
  groupId: "g0000000-0000-4000-8000-000000000001",
  roundId: "r0000000-0000-4000-8000-000000000001",
};
const FORGOTTEN = 1;

type Forget = CourtAccountForget["forgetSessionsOf"];

interface SetupOptions {
  readonly provider?: AuthProvider;
  readonly accountKeyOf?: (session: SessionIdentity) => Promise<string | null>;
  readonly forget?: Forget;
}

function setup(options: SetupOptions = {}) {
  const fake = createFakeSacouApi();
  const auth = createFakeAuthSession({
    initial: {
      status: "signedIn",
      account: { provider: options.provider ?? "google", email: null, displayName: null },
    },
  });
  const order: string[] = [];
  const forgotten: string[] = [];
  const log = createFakeCourtEventLog(createSequentialIdGenerator());
  const forget: Forget =
    options.forget ??
    ((ownerKey) => {
      return log.forgetSessionsOf(ownerKey);
    });
  const deps: DeletionDeps = {
    api: {
      deleteMyAccount: () => {
        order.push("deleteMyAccount");
        return fake.api.deleteMyAccount();
      },
    },
    auth: {
      currentSession: () => auth.currentSession(),
      reauthenticate: (proof) => auth.reauthenticate(proof),
      accountKeyOf: (session) => {
        order.push("accountKeyOf");
        return (options.accountKeyOf ?? ((s) => auth.accountKeyOf(s)))(session);
      },
    },
    ender: {
      endDeleted: () => {
        order.push("endDeleted");
        return Promise.resolve();
      },
    },
    court: {
      forgetSessionsOf: (ownerKey) => {
        order.push("forgetSessionsOf");
        forgotten.push(ownerKey);
        return forget(ownerKey);
      },
    },
    refreshBlockers: () => Promise.resolve(),
  };
  return { fake, auth, order, forgotten, log, deps };
}

const run = (deps: DeletionDeps, provider: AuthProvider = "google") =>
  deleteAccount(deps, { provider, password: null });

const consoleMethods = ["log", "info", "warn", "error", "debug"] as const;

function spyOnConsole() {
  return consoleMethods.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the court of the deleted account leaves the device (E6.8)", () => {
  test("T7: on 204 the order is delete, key, forget, end", async () => {
    const { fake, order, forgotten, auth, deps } = setup();
    const session = auth.currentSession();
    if (session === null) throw new Error("signed in");
    const key = await auth.accountKeyOf(session);
    fake.respond("deleteMyAccount", apiOk(null));
    expect(await run(deps)).toEqual({ kind: "deleted" });
    expect(order).toEqual(["deleteMyAccount", "accountKeyOf", "forgetSessionsOf", "endDeleted"]);
    expect(forgotten).toEqual([key]);
  });

  test.each<[string, ApiError, AuthProvider]>([
    ["409 of a blocker", BLOCKED, "google"],
    ["recent login of an e-mail account without the password", RECENT, "password"],
    ["offline", { kind: "offline" }, "google"],
    ["5xx", { kind: "unavailable", retryAfterMs: 0 }, "google"],
  ])("T7: %s forgets nothing", async (_name, error, provider) => {
    const { fake, forgotten, deps } = setup({ provider });
    fake.respond("deleteMyAccount", apiErr(error));
    expect((await run(deps, provider)).kind).not.toBe("deleted");
    expect(forgotten).toEqual([]);
  });

  test("T7: Google with a new login and a 204 on the second try forgets once", async () => {
    const { fake, forgotten, deps } = setup();
    fake.respond("deleteMyAccount", apiErr(RECENT));
    const pending = run(deps);
    fake.respond("deleteMyAccount", apiOk(null));
    expect(await pending).toEqual({ kind: "deleted" });
    expect(forgotten).toHaveLength(1);
  });

  test("T8: an unknown key forgets nothing and the deletion still ends", async () => {
    const { fake, order, deps } = setup({ accountKeyOf: () => Promise.resolve(null) });
    fake.respond("deleteMyAccount", apiOk(null));
    const outcome = await run(deps);
    expect(outcome).toEqual({ kind: "deleted" });
    expect(order).toEqual(["deleteMyAccount", "accountKeyOf", "endDeleted"]);
    expect(deletionOutcomeText(outcome)).toBeNull();
  });

  test.each<[string, Forget]>([
    [
      "answers storage-failed",
      (): Promise<CourtLogResult<number>> =>
        Promise.resolve({ ok: false, error: { code: "storage-failed" } }),
    ],
    ["rejects", (): Promise<CourtLogResult<number>> => Promise.reject(new Error("disk"))],
  ])("T8: a forget that %s never blocks the deletion", async (_name, forget) => {
    const { fake, order, deps } = setup({ forget });
    fake.respond("deleteMyAccount", apiOk(null));
    const outcome = await run(deps);
    expect(outcome).toEqual({ kind: "deleted" });
    expect(order.at(-1)).toBe("endDeleted");
    expect(deletionOutcomeText(outcome)).toBeNull();
  });

  test("T8: a key that rejects never blocks the deletion", async () => {
    const { fake, order, deps } = setup({
      accountKeyOf: () => Promise.reject(new Error("crypto")),
    });
    fake.respond("deleteMyAccount", apiOk(null));
    expect(await run(deps)).toEqual({ kind: "deleted" });
    expect(order).toEqual(["deleteMyAccount", "accountKeyOf", "endDeleted"]);
  });

  test("T9: an account signed in meanwhile keeps its court; only the deleted one is forgotten", async () => {
    const { fake, auth, forgotten, log, deps } = setup();
    const deleted = auth.currentSession();
    if (deleted === null) throw new Error("signed in");
    const keyOfDeleted = await auth.accountKeyOf(deleted);
    const other = fakeSessionIdentity();
    const keyOfOther = await auth.accountKeyOf(other);
    await log.openSession(SESSION_OF_A, { ...ROUND, ownerKey: keyOfDeleted });
    await log.openSession(SESSION_OF_B, { ...ROUND, ownerKey: keyOfOther });
    fake.respond("deleteMyAccount", apiOk(null));

    const pending = run(deps);
    auth.emit(auth.snapshot(), other);
    expect(await pending).toEqual({ kind: "deleted" });

    expect(forgotten).toEqual([keyOfDeleted]);
    expect((await log.load(SESSION_OF_A)).ok).toBe(false);
    expect(await log.load(SESSION_OF_B)).toMatchObject({
      ok: true,
      value: { ownerKey: keyOfOther },
    });
  });

  test("T11: nothing about the forget reaches the console", async () => {
    const spies = spyOnConsole();
    const ok = setup();
    ok.fake.respond("deleteMyAccount", apiOk(null));
    await run(ok.deps);
    const failing = setup({ forget: () => Promise.reject(new Error("disk")) });
    failing.fake.respond("deleteMyAccount", apiOk(null));
    await run(failing.deps);
    const unknown = setup({ accountKeyOf: () => Promise.resolve(null) });
    unknown.fake.respond("deleteMyAccount", apiOk(null));
    await run(unknown.deps);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(ok.forgotten).toHaveLength(FORGOTTEN);
  });

  test("T11: forgetSessionsOf answering Err(storage-failed) does not block the deletion", async () => {
    const spies = spyOnConsole();
    let calls = 0;
    const { fake, order, deps } = setup({
      forget: () => {
        calls += 1;
        return Promise.resolve({ ok: false, error: { code: "storage-failed" } });
      },
    });
    fake.respond("deleteMyAccount", apiOk(null));
    const outcome = await run(deps);
    expect(calls).toBe(1);
    expect(outcome).toEqual({ kind: "deleted" });
    expect(order).toEqual(["deleteMyAccount", "accountKeyOf", "forgetSessionsOf", "endDeleted"]);
    expect(deletionOutcomeText(outcome)).toBeNull();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  test("T11: nothing reaches the error reporter (the flow receives none)", async () => {
    // DeletionDeps has no ErrorReporter field, so the flow cannot report a forget failure. This
    // guard keeps that true: a reporter added later must come with a scrubbed context (no owner
    // key, no count) and its own test.
    const failing = setup({ forget: () => Promise.reject(new Error("disk")) });
    expect(Object.keys(failing.deps).sort()).toEqual(
      ["api", "auth", "court", "ender", "refreshBlockers"].sort(),
    );
    const reporter = createFakeErrorReporter();
    failing.fake.respond("deleteMyAccount", apiOk(null));
    await run(failing.deps);
    expect(reporter.captured()).toEqual([]);
    expect(reporter.nativeCrashes()).toBe(0);
  });
});
