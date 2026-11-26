import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeAuthSession, fakeSessionIdentity } from "../../../adapters/fake-auth-session";
import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { DeletionBlocker } from "../../../services/api/sacou-api";
import type { AuthProvider, SignOutReason } from "../../../services/auth/auth-session";
import type { SessionEnder } from "../../../services/session/end-session";
import { apiErrorKindTexts, apiErrorTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { groupMembersHref } from "../../groups/navigation";
import {
  asksForPassword,
  deleteAccount,
  deletionOutcomeText,
  type DeletionOutcome,
} from "./delete-account-flow";
import { deleteAccountReducer, initialDeleteAccountState } from "./delete-account.reducer";
import {
  blockerNotice,
  blockerSentence,
  canDelete,
  confirmMatches,
} from "./delete-account.selectors";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { deleteAccountMutation } from "../queries/account-queries";
import { createPasswordHandoff } from "./password-handoff";
import { createSingleFlight } from "./single-flight";

const texts = strings.account.deleteScreen;
const BLOCKED: ApiError = { kind: "problem", status: 409, code: "identity.deletion-blocked" };
const RECENT: ApiError = { kind: "problem", status: 403, code: "identity.recent-login-required" };

function blocker(groupId: string, groupName: string): DeletionBlocker {
  return { groupId, groupName, kind: "lastAdmin" };
}

function setup() {
  const fake = createFakeSacouApi();
  const auth = createFakeAuthSession({
    initial: {
      status: "signedIn",
      account: { provider: "google", email: null, displayName: null },
    },
  });
  const ended: SignOutReason[] = [];
  const refreshed = { count: 0 };
  const ender: Pick<SessionEnder, "endDeleted"> = {
    endDeleted: (session) => {
      if (session === auth.currentSession()) ended.push("deleted");
      return Promise.resolve();
    },
  };
  const deps = {
    api: fake.api,
    auth,
    ender,
    court: createFakeCourtEventLog(createSequentialIdGenerator()),
    refreshBlockers: () => {
      refreshed.count += 1;
      return Promise.resolve();
    },
  };
  const deletes = () => fake.calls().filter((call) => call.operation === "deleteMyAccount").length;
  return { fake, auth, ended, refreshed, deps, deletes };
}

type Deps = ReturnType<typeof setup>["deps"];

const run = (deps: Deps, provider: AuthProvider) =>
  deleteAccount(deps, { provider, password: null });

describe("confirmMatches (ADR 0057)", () => {
  test.each(["EXCLUIR", "excluir", " EXCLUIR ", "Excluir"])("%j counts", (text) => {
    expect(confirmMatches(text)).toBe(true);
  });
  test.each(["EXCLUI", "EXCLUIR!", "", "EXCLUIR EXCLUIR"])("%j does not", (text) => {
    expect(confirmMatches(text)).toBe(false);
  });
});

describe("the blockers of screen 30b", () => {
  test("one group: the notice with its name", () => {
    const notice = blockerNotice([blocker("g1", "Racha de terça")]);
    expect(notice).toEqual({ groupName: "Racha de terça", others: 0, firstGroupId: "g1" });
    expect(notice && blockerSentence(notice)).toBe(
      "Você é o único admin do Racha de terça. Passe o papel para alguém antes de excluir.",
    );
  });

  test("three groups: one name and 'e de mais 2 grupos'", () => {
    const notice = blockerNotice([
      blocker("g1", "Racha de terça"),
      blocker("g2", "Vôlei do clube"),
      blocker("g3", "Praia"),
    ]);
    expect(notice && blockerSentence(notice)).toBe(
      "Você é o único admin do Racha de terça e de mais 2 grupos. Passe o papel para alguém antes de excluir.",
    );
    expect(texts.blockerMore(1)).toBe(" e de mais 1 grupo");
  });

  test("a group without a name to show is 'um grupo', never the ID", () => {
    const notice = blockerNotice([blocker("8a4c2f0e-1111", "  ")]);
    const sentence = notice === null ? "" : blockerSentence(notice);
    expect(sentence).toContain("de um grupo");
    expect(sentence).not.toContain("8a4c2f0e");
  });

  test("no blockers: no notice", () => {
    expect(blockerNotice([])).toBeNull();
  });

  test("with a blocker the button stays off even with EXCLUIR", () => {
    const base = { confirmText: "EXCLUIR", pending: false, asksForPassword: false, password: "" };
    expect(canDelete({ ...base, blockers: [blocker("g1", "Racha")] })).toBe(false);
    expect(canDelete({ ...base, blockers: undefined })).toBe(false);
    expect(canDelete({ ...base, blockers: [] })).toBe(true);
    expect(canDelete({ ...base, blockers: [], pending: true })).toBe(false);
    expect(canDelete({ ...base, blockers: [], confirmText: "EXCLUI" })).toBe(false);
    expect(canDelete({ ...base, blockers: [], asksForPassword: true })).toBe(false);
    expect(canDelete({ ...base, blockers: [], asksForPassword: true, password: "123456" })).toBe(
      true,
    );
  });

  test("'Escolher outro admin' opens the members of the first group", () => {
    const notice = blockerNotice([blocker("g1", "A"), blocker("g2", "B")]);
    expect(notice && groupMembersHref(notice.firstGroupId)).toEqual(groupMembersHref("g1"));
  });
});

describe("the reducer of screen 30b", () => {
  test("typing, the password and its emptying after it is sent", () => {
    const typed = deleteAccountReducer(initialDeleteAccountState, {
      type: "confirm-changed",
      text: "excluir",
    });
    const withPassword = deleteAccountReducer(typed, { type: "password-changed", text: " 12345 " });
    expect(withPassword).toEqual({ confirmText: "excluir", password: " 12345 " });
    expect(deleteAccountReducer(withPassword, { type: "password-sent" })).toEqual({
      confirmText: "excluir",
      password: "",
    });
  });

  test("a new action without its case does not compile", () => {
    // @ts-expect-error: the switch of the reducer is exhaustive
    deleteAccountReducer(initialDeleteAccountState, { type: "unknown" });
  });
});

describe("deleting the account (E4.3, D9; ADR 0056, D4 and D7)", () => {
  test("204 ends the session as deleted", async () => {
    const { fake, ended, deps } = setup();
    fake.respond("deleteMyAccount", apiOk(null));
    expect(await run(deps, "google")).toEqual({ kind: "deleted" });
    expect(ended).toEqual(["deleted"]);
  });

  test("204 ends the session of the account that asked, not of one signed in meanwhile", async () => {
    const { fake, auth, ended, deps } = setup();
    fake.respond("deleteMyAccount", apiOk(null));
    const pending = run(deps, "google");
    auth.emit(auth.snapshot(), fakeSessionIdentity());
    expect(await pending).toEqual({ kind: "deleted" });
    expect(ended).toEqual([]);
  });

  test("409 of a blocker made meanwhile reads the blockers again", async () => {
    const { fake, ended, refreshed, deps } = setup();
    fake.respond("deleteMyAccount", apiErr(BLOCKED));
    const outcome = await run(deps, "google");
    expect(outcome).toEqual({ kind: "blocked" });
    expect(refreshed.count).toBe(1);
    expect(ended).toEqual([]);
    expect(deletionOutcomeText(outcome)).toBe(apiErrorTexts["identity.deletion-blocked"]);
  });

  test("Google: recent login required, the picker again and one more DELETE", async () => {
    const { fake, auth, ended, deps, deletes } = setup();
    fake.respond("deleteMyAccount", apiErr(RECENT));
    const pending = run(deps, "google");
    fake.respond("deleteMyAccount", apiOk(null));
    expect(await pending).toEqual({ kind: "deleted" });
    expect(auth.calls()).toEqual([{ method: "reauthenticate" }]);
    expect(deletes()).toBe(2);
    expect(ended).toEqual(["deleted"]);
  });

  test("a second refusal after the new login is shown, without a loop", async () => {
    const { fake, auth, deps, deletes } = setup();
    fake.respond("deleteMyAccount", apiErr(RECENT));
    const outcome = await run(deps, "google");
    expect(outcome).toEqual({ kind: "failed", error: RECENT });
    expect(deletes()).toBe(2);
    expect(auth.calls()).toHaveLength(1);
    expect(deletionOutcomeText(outcome)).toBe(apiErrorTexts["identity.recent-login-required"]);
  });

  test("a cancelled picker says nothing and deletes nothing more", async () => {
    const { fake, auth, deps, deletes } = setup();
    fake.respond("deleteMyAccount", apiErr(RECENT));
    auth.fail("reauthenticate", "cancelled");
    const outcome = await run(deps, "google");
    expect(outcome).toEqual({ kind: "reauth-failed", failure: "cancelled" });
    expect(deletionOutcomeText(outcome)).toBeNull();
    expect(asksForPassword("google", outcome)).toBe(false);
    expect(deletes()).toBe(1);
  });

  test("e-mail: the password is asked on the screen, then sent with one more DELETE", async () => {
    const { fake, auth, ended, deps, deletes } = setup();
    fake.respond("deleteMyAccount", apiErr(RECENT));
    const first = await run(deps, "password");
    expect(first.kind).toBe("reauth-required");
    expect(asksForPassword("password", first)).toBe(true);
    expect(deletionOutcomeText(first)).toBe(texts.passwordHelp);
    expect(auth.calls()).toEqual([]);

    fake.respond("deleteMyAccount", apiOk(null));
    expect(await deleteAccount(deps, { provider: "password", password: "123456" })).toEqual({
      kind: "deleted",
    });
    expect(auth.calls()).toEqual([{ method: "reauthenticate" }]);
    expect(deletes()).toBe(2);
    expect(ended).toEqual(["deleted"]);
  });

  test("a wrong password keeps the field and says so; nothing is deleted", async () => {
    const { auth, deps, deletes } = setup();
    auth.fail("reauthenticate", "invalid-credentials");
    const outcome = await deleteAccount(deps, { provider: "password", password: "errada" });
    expect(outcome).toEqual({ kind: "reauth-failed", failure: "invalid-credentials" });
    expect(asksForPassword("password", outcome)).toBe(true);
    expect(deletionOutcomeText(outcome)).toBe(strings.auth.failures["invalid-credentials"]);
    expect(deletes()).toBe(0);
  });

  test("offline is the text of the kind, and the session stays", async () => {
    const { fake, ended, deps } = setup();
    fake.respond("deleteMyAccount", apiErr({ kind: "offline" }));
    expect(deletionOutcomeText(await run(deps, "google"))).toBe(apiErrorKindTexts.offline);
    expect(ended).toEqual([]);
  });

  test("a double tap sends one DELETE", async () => {
    const { fake, deps, deletes } = setup();
    fake.respond("deleteMyAccount", apiOk(null));
    const flight = createSingleFlight<DeletionOutcome>();
    const [first, second] = await Promise.all([
      flight.run(() => run(deps, "google")),
      flight.run(() => run(deps, "google")),
    ]);
    expect(first).toEqual(second);
    expect(deletes()).toBe(1);
  });
});

describe("two taps on Excluir in the same frame (ADR 0057)", () => {
  test("send one deleteMyAccount", async () => {
    const { fake, deps, deletes } = setup();
    fake.respond("deleteMyAccount", apiOk(null));
    const observer = new MutationObserver(
      createSacouQueryClient(),
      deleteAccountMutation({
        deletion: deps,
        provider: "google",
        password: createPasswordHandoff(),
        flight: createSingleFlight<DeletionOutcome>(),
      }),
    );
    const [first, second] = await Promise.all([observer.mutate(), observer.mutate()]);
    expect(first).toEqual(second);
    expect(deletes()).toBe(1);
  });
});

describe("the password never stays in the mutation (ADR 0057, D12)", () => {
  const PASSWORD = "errada-Qw7";

  test("after a wrong password, neither the variables nor the cache hold it", async () => {
    const { auth, deps } = setup();
    auth.fail("reauthenticate", "invalid-credentials");
    const client = createSacouQueryClient();
    const seen: unknown[] = [];
    client.getMutationCache().subscribe((event) => {
      seen.push(event.mutation?.state);
    });
    const password = createPasswordHandoff();
    const observer = new MutationObserver(
      client,
      deleteAccountMutation({
        deletion: deps,
        provider: "password",
        password,
        flight: createSingleFlight<DeletionOutcome>(),
      }),
    );
    password.give(PASSWORD);
    const outcome = await observer.mutate();
    expect(outcome).toEqual({ kind: "reauth-failed", failure: "invalid-credentials" });
    expect(auth.calls()).toEqual([{ method: "reauthenticate" }]);
    expect(observer.getCurrentResult().variables).toBeUndefined();
    expect(JSON.stringify(seen)).not.toContain(PASSWORD);
    expect(password.take()).toBeNull();
  });
});
