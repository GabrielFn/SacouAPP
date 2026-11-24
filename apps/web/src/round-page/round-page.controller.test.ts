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

describe("createRoundPage", () => {
  it("VOU signed out: Google, POST /v1/me, the nickname of the provider, then the answer with the code in the body", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(fakeAuth(calls), fakeApi(calls, { hasProfile: false }));
    await page.start();
    await page.tapAnswer("going");
    await page.signInWithGoogle();
    expect(page.state()).toEqual({
      step: "nickname",
      intent: "going",
      suggestion: "Ana",
      failure: null,
    });
    await page.submitNickname("  Aninha ");
    expect(calls.log).toEqual(["popup", "register", "nickname:Aninha", `answer:${CODE}:going`]);
    expect(page.state()).toMatchObject({
      step: "idle",
      signedIn: true,
      standing: { status: "going", position: 10 },
    });
  });

  it("VOU signed in: one tap answers, after the standing of a member is loaded", async () => {
    const calls: Calls = { log: [] };
    const standing: Standing = { status: "waitlisted", position: 2 };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: null } }),
      fakeApi(calls, { standing }),
    );
    await page.start();
    expect(page.state()).toMatchObject({ step: "idle", signedIn: true, standing });
    await page.tapAnswer("going");
    expect(calls.log).toEqual(["register", `standing:${CODE}`, `answer:${CODE}:going`]);
  });

  it("NÃO VOU MAIS asks first, sends nothing until confirmed, and a second tap sends once (R101, item 3b)", async () => {
    const calls: Calls = { log: [] };
    const standing: Standing = { status: "going", position: 3 };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: null } }),
      fakeApi(calls, { standing }),
    );
    await page.start();
    await page.tapAnswer("notGoing");
    expect(page.state()).toEqual({ step: "confirmingLeave", standing });
    expect(calls.log).toEqual(["register", `standing:${CODE}`]);
    await Promise.all([page.confirmLeave(), page.confirmLeave()]);
    expect(calls.log).toEqual(["register", `standing:${CODE}`, `answer:${CODE}:notGoing`]);
  });

  it("CONTINUAR NA LISTA goes back to the standing and sends nothing", async () => {
    const calls: Calls = { log: [] };
    const standing: Standing = { status: "waitlisted", position: 2 };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: null } }),
      fakeApi(calls, { standing }),
    );
    await page.start();
    await page.tapAnswer("notGoing");
    await page.keepPlace();
    expect(page.state()).toMatchObject({ step: "idle", signedIn: true, standing, failure: null });
    expect(calls.log).toEqual(["register", `standing:${CODE}`]);
  });

  it("whoever holds no place leaves without a question", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(fakeAuth(calls, { user: { displayName: null } }), fakeApi(calls));
    await page.start();
    await page.tapAnswer("notGoing");
    expect(calls.log).toEqual(["register", `standing:${CODE}`, `answer:${CODE}:notGoing`]);
  });

  it("a blocked popup keeps the intent and goes to the redirect", async () => {
    const calls: Calls = { log: [] };
    const { page, intents } = setUp(
      fakeAuth(calls, { popup: { kind: "popupBlocked" } }),
      fakeApi(calls),
    );
    await page.start();
    await page.tapAnswer("notGoing");
    await page.signInWithGoogle();
    expect(calls.log.slice(0, 2)).toEqual(["popup", "redirect"]);
    expect(intents.kept).toBe("notGoing");
  });

  it("the intent comes back after the redirect and is answered without another tap", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: "Ana" } }),
      fakeApi(calls),
      memoryIntents("going"),
    );
    await page.start();
    expect(calls.log).toEqual(["register", `answer:${CODE}:going`]);
  });

  it("an intent left in the storage of a signed-out visitor is dropped", async () => {
    const calls: Calls = { log: [] };
    const intents = memoryIntents("going");
    const { page } = setUp(fakeAuth(calls), fakeApi(calls), intents);
    await page.start();
    expect(intents.kept).toBeNull();
    expect(page.state()).toMatchObject({ step: "idle", signedIn: false });
  });

  it("a refused registration (410) signs the browser out", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: null } }),
      fakeApi(calls, { register: { ok: false, failure: { kind: "accountDeleted" } } }),
    );
    await page.start();
    expect(calls.log).toEqual(["register", "signOut"]);
    expect(page.state()).toMatchObject({
      step: "idle",
      signedIn: false,
      failure: { kind: "accountDeleted" },
    });
  });

  it("e-mail: the mode of the form picks sign-in, sign-up or the reset link", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(
      fakeAuth(calls, { email: { kind: "failed", failure: { kind: "invalidCredentials" } } }),
      fakeApi(calls),
    );
    await page.start();
    await page.tapAnswer("going");
    await page.submitEmail("a@b.c", "x");
    expect(calls.log).toEqual([]);
    page.chooseForm("signIn");
    await page.submitEmail("a@b.c", "secret1");
    expect(page.state()).toMatchObject({
      step: "signIn",
      form: "signIn",
      failure: { kind: "invalidCredentials" },
    });
    page.chooseForm("reset");
    await page.submitEmail("a@b.c", "");
    expect(page.state()).toMatchObject({ step: "signIn", notice: "resetSent" });
    page.chooseForm("signUp");
    await page.submitEmail("a@b.c", "secret1");
    expect(calls.log).toEqual([
      "email:a@b.c",
      "reset",
      "signUp:a@b.c",
      "register",
      `answer:${CODE}:going`,
    ]);
  });

  it("a refused answer keeps the person in the group's message", async () => {
    const calls: Calls = { log: [] };
    const { page } = setUp(
      fakeAuth(calls, { user: { displayName: null } }),
      fakeApi(calls, {
        answer: { ok: false, failure: { kind: "dropInWindowClosed", joined: true } },
      }),
    );
    await page.start();
    await page.tapAnswer("going");
    expect(page.state()).toMatchObject({
      step: "idle",
      failure: { kind: "dropInWindowClosed", joined: true },
    });
  });

  it("signs out on request", async () => {
    const calls: Calls = { log: [] };
    const { page, states } = setUp(
      fakeAuth(calls, { user: { displayName: null } }),
      fakeApi(calls),
    );
    await page.start();
    await page.signOut();
    expect(page.state()).toMatchObject({ step: "idle", signedIn: false });
    expect(states.length).toBeGreaterThan(1);
  });
});
