import { describe, expect, test } from "vitest";

import {
  createFakeAuthSession,
  FAKE_ACCOUNT,
  fakeAccountKeyOf,
  fakeSessionIdentity,
} from "../../../adapters/fake-auth-session";
import { courtAccountOf } from "./court-account";

describe("courtAccountOf (ADR 0067, D8)", () => {
  test("nobody signed in: no account", async () => {
    const session = createFakeAuthSession({ initial: { status: "signedOut", reason: null } });
    expect(await courtAccountOf(session).current()).toBeNull();
  });

  test("the session and its key, the same key for the same account", async () => {
    const session = createFakeAuthSession({
      initial: { status: "signedIn", account: FAKE_ACCOUNT },
    });
    const account = courtAccountOf(session);
    const first = await account.current();
    expect(first?.session).toBe(session.currentSession());
    expect((await account.current())?.key).toBe(first?.key);
  });

  test("another account has another key", async () => {
    const session = createFakeAuthSession({
      initial: { status: "signedIn", account: FAKE_ACCOUNT },
    });
    const account = courtAccountOf(session);
    const before = await account.current();
    const other = fakeSessionIdentity();
    session.emit({ status: "signedIn", account: FAKE_ACCOUNT }, other);
    const after = await account.current();
    expect(after?.key).toBe(fakeAccountKeyOf(other));
    expect(after?.key).not.toBe(before?.key);
  });
});
