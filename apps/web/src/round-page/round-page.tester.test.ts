import { describe, expect, it } from "vitest";

import type {
  ApiOutcome,
  ApiPort,
  AuthOutcome,
  AuthPort,
  PendingIntentStore,
  SessionUser,
} from "./ports";
import { createRoundPage } from "./round-page.controller";
import type { Intent, RoundPageState, Standing } from "./round-page.types";

const CODE = "K7fQ2xK7fQ2xK7fQ2xK7fQ";
const done: AuthOutcome = { kind: "done" };

interface Calls {
  readonly log: string[];
}

function fakeAuth(
  calls: Calls,
  options: { user?: SessionUser | null; popup?: AuthOutcome; email?: AuthOutcome } = {},
): AuthPort {
  let user: SessionUser | null = options.user ?? null;
  const signIn = (outcome: AuthOutcome) => {
    if (outcome.kind === "done") user = { displayName: "Ana Maria Souza" };
    return Promise.resolve(outcome);
  };
  return {
    restore: () => Promise.resolve(user),
    signInWithGooglePopup: () => {
      calls.log.push("popup");
      return signIn(options.popup ?? done);
    },
    signInWithGoogleRedirect: () => {
      calls.log.push("redirect");
      return Promise.resolve(done);
    },
    signInWithEmail: (email) => {
      calls.log.push(`email:${email}`);
      return signIn(options.email ?? done);
    },
    signUpWithEmail: (email) => {
      calls.log.push(`signUp:${email}`);
      return signIn(done);
    },
    sendPasswordReset: () => {
      calls.log.push("reset");
      return Promise.resolve(done);
    },
    currentUser: () => user,
    idToken: () => Promise.resolve(user === null ? null : "token"),
    signOut: () => {
      calls.log.push("signOut");
      user = null;
      return Promise.resolve();
    },
  };
}

function fakeApi(
  calls: Calls,
  options: {
    hasProfile?: boolean;
    register?: ApiOutcome<{ hasProfile: boolean }>;
    answer?: ApiOutcome<Standing>;
    standing?: Standing | null;
  } = {},
): ApiPort {
  return {
    register: () => {
      calls.log.push("register");
      return Promise.resolve(
        options.register ?? { ok: true, value: { hasProfile: options.hasProfile ?? true } },
      );
    },
    saveNickname: (nickname) => {
      calls.log.push(`nickname:${nickname}`);
      return Promise.resolve({ ok: true, value: null });
    },
    answer: (code, intent) => {
      calls.log.push(`answer:${code}:${intent}`);
      return Promise.resolve(
        options.answer ?? {
          ok: true,
          value: { status: intent, position: intent === "going" ? 10 : null },
        },
      );
    },
    standing: (code) => {
      calls.log.push(`standing:${code}`);
      return Promise.resolve({ ok: true, value: options.standing ?? null });
    },
  };
}

function memoryIntents(
  initial: Intent | null = null,
): PendingIntentStore & { kept: Intent | null } {
  const store = {
    kept: initial,
    keep: (intent: Intent) => {
      store.kept = intent;
    },
    take: () => {
      const kept = store.kept;
      store.kept = null;
      return kept;
    },
  };
  return store;
}

function setUp(auth: AuthPort, api: ApiPort, intents = memoryIntents()) {
  const states: RoundPageState[] = [];
  const page = createRoundPage({
    code: CODE,
    auth,
    api,
    intents,
    nicknameMaxCodePoints: 20,
    onChange: (state) => states.push(state),
  });
  return { page, states, intents };
}

describe("createRoundPage (tester, E3.12 part 2)", () => {
  it("VOU on a full round lands in the waitlist and says the position", async () => {
    const calls: Calls = { log: [] };
    const waitlisted: Standing = { status: "waitlisted", position: 3 };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: "Ana" } }),
      fakeApi(calls, { answer: { ok: true, value: waitlisted } }),
    );
    await page.start();
    await page.tapAnswer("going");
    expect(page.state()).toMatchObject({
      step: "idle",
      signedIn: true,
      standing: waitlisted,
      failure: null,
    });
  });

  it("a network failure on the answer shows the error and keeps the person signed in", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: "Ana" } }),
      fakeApi(calls, { answer: { ok: false, failure: { kind: "offline" } } }),
    );
    await page.start();
    await page.tapAnswer("going");
    expect(page.state()).toMatchObject({
      step: "idle",
      signedIn: true,
      failure: { kind: "offline" },
    });
  });

  it("a network failure on the registration after sign-in shows the error, with no answer sent", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(
      fakeAuth(calls),
      fakeApi(calls, { register: { ok: false, failure: { kind: "offline" } } }),
    );
    await page.start();
    await page.tapAnswer("going");
    await page.signInWithGoogle();
    expect(calls.log.some((entry) => entry.startsWith("answer:"))).toBe(false);
    expect(page.state()).not.toMatchObject({ step: "answering" });
    expect(JSON.stringify(page.state())).toContain("offline");
  });

  it("VOU signed out never calls the API before the login", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(fakeAuth(calls), fakeApi(calls));
    await page.start();
    await page.tapAnswer("going");
    expect(calls.log).toEqual([]);
    expect(page.state()).toMatchObject({ step: "signIn", intent: "going" });
  });
});
