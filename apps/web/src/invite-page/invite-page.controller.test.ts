import { describe, expect, it } from "vitest";

import { createInviteFetchApi } from "../adapters/invite-fetch-api";
import type { AuthOutcome, AuthPort, SessionUser } from "../round-page/ports";

import { createInvitePage } from "./invite-page.controller";
import type { InvitePageState } from "./invite-page.types";
import { takeInviteToken } from "./invite-token";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde";
const done: AuthOutcome = { kind: "done" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PREVIEW = { groupName: "Vôlei de quinta", activeMembers: 14, alreadyMember: false };

function fakeAuth(log: string[], options: { user?: SessionUser | null; popup?: AuthOutcome } = {}) {
  let user: SessionUser | null = options.user ?? null;
  const signIn = (outcome: AuthOutcome) => {
    if (outcome.kind === "done") user = { displayName: "Ana" };
    return Promise.resolve(outcome);
  };
  const auth: AuthPort = {
    restore: () => Promise.resolve(user),
    signInWithGooglePopup: () => {
      log.push("popup");
      return signIn(options.popup ?? done);
    },
    signInWithGoogleRedirect: () => {
      log.push("redirect");
      return Promise.resolve(done);
    },
    signInWithEmail: () => signIn(done),
    signUpWithEmail: () => signIn(done),
    sendPasswordReset: () => Promise.resolve(done),
    currentUser: () => user,
    idToken: () => Promise.resolve(user === null ? null : "id-token"),
    signOut: () => {
      log.push("signOut");
      user = null;
      return Promise.resolve();
    },
  };
  return auth;
}

interface Request {
  readonly url: string;
  readonly body: string | null;
}

/** The page as the browser runs it: the token read from the address, the real fetch adapter over a spy. */
function page(
  hash: string,
  responses: readonly Response[],
  options: { user?: SessionUser | null; popup?: AuthOutcome } = {},
) {
  const log: string[] = [];
  const requests: Request[] = [];
  const states: InvitePageState[] = [];
  const queue = [...responses];
  const location = { hash, pathname: "/c", search: "" };
  const history = {
    replaceState: (_data: unknown, _unused: string, url: string) => {
      log.push(`replaceState:${url}`);
    },
  };
  const token = takeInviteToken(location, history);
  const auth = fakeAuth(log, options);
  const invite = createInvitePage({
    token,
    auth,
    api: createInviteFetchApi({
      fetch: (url, init) => {
        log.push(`fetch:${url}`);
        requests.push({ url, body: typeof init.body === "string" ? init.body : null });
        const next = queue.shift();
        return next === undefined
          ? Promise.reject(new TypeError("offline"))
          : Promise.resolve(next);
      },
      idToken: () => auth.idToken(),
    }),
    onChange: (state) => states.push(state),
  });
  return { invite, log, requests, states };
}

const signedIn = { user: { displayName: "Ana" } };

describe("the invite page (case 34)", () => {
  it("clears the fragment before the first request, and the token goes only in the bodies", async () => {
    const run = page(`#${TOKEN}`, [json(200, {}), json(200, PREVIEW), json(201, {})], signedIn);

    await run.invite.start();
    await run.invite.join();

    expect(run.log[0]).toBe("replaceState:/c");
    expect(run.requests.map((request) => request.url)).toEqual([
      "/v1/me",
      "/v1/invites/preview",
      "/v1/invites/accept",
    ]);
    for (const request of run.requests) expect(request.url).not.toContain(TOKEN);
    expect(JSON.parse(run.requests[1]?.body ?? "")).toEqual({ token: TOKEN });
    expect(JSON.parse(run.requests[2]?.body ?? "")).toEqual({ token: TOKEN });
    expect(run.invite.state()).toEqual({
      step: "joined",
      groupName: "Vôlei de quinta",
      alreadyMember: false,
    });
    for (const state of run.states) expect(JSON.stringify(state)).not.toContain(TOKEN);
  });

  it.each(["", "#", "#short", `#${TOKEN}x`, `#${TOKEN.slice(1)}!`])(
    "a missing or malformed token (%s) asks nothing and says the link is dead",
    async (hash) => {
      const run = page(hash, [], signedIn);

      await run.invite.start();

      expect(run.requests).toHaveLength(0);
      expect(run.invite.state()).toEqual({ step: "failed", failure: { kind: "inviteInvalid" } });
    },
  );

  it("a revoked, expired or unknown token is the same 'Link inválido ou desativado.'", async () => {
    const run = page(
      `#${TOKEN}`,
      [json(200, {}), json(404, { code: "groups.invite-invalid" })],
      signedIn,
    );

    await run.invite.start();

    expect(run.invite.state()).toEqual({ step: "failed", failure: { kind: "inviteInvalid" } });
  });

  it("signed out: the sheet first, then the preview with the same token in memory", async () => {
    const run = page(`#${TOKEN}`, [json(200, {}), json(200, PREVIEW)]);

    await run.invite.start();
    expect(run.invite.state()).toEqual({ step: "idle", signedIn: false, failure: null });
    await run.invite.tapSignIn();
    await run.invite.signInWithGoogle();

    expect(run.invite.state()).toEqual({ step: "preview", preview: PREVIEW, failure: null });
    expect(JSON.parse(run.requests[1]?.body ?? "")).toEqual({ token: TOKEN });
  });

  it("a blocked Google window never redirects (the token would be lost): the e-mail is offered", async () => {
    const run = page(`#${TOKEN}`, [], { popup: { kind: "popupBlocked" } });

    await run.invite.start();
    await run.invite.tapSignIn();
    await run.invite.signInWithGoogle();

    expect(run.log).not.toContain("redirect");
    expect(run.invite.state()).toEqual({
      step: "signIn",
      form: "choice",
      failure: { kind: "providerUnavailable" },
      notice: null,
    });
  });

  it("who is in already sees it without joining again", async () => {
    const run = page(
      `#${TOKEN}`,
      [json(200, {}), json(200, { ...PREVIEW, alreadyMember: true })],
      signedIn,
    );

    await run.invite.start();

    expect(run.requests.map((request) => request.url)).not.toContain("/v1/invites/accept");
    expect(run.invite.state()).toEqual({
      step: "joined",
      groupName: "Vôlei de quinta",
      alreadyMember: true,
    });
  });

  it("removed from the group: the accept's 403 ends the flow", async () => {
    const run = page(
      `#${TOKEN}`,
      [json(200, {}), json(200, PREVIEW), json(403, { code: "groups.member-removed" })],
      signedIn,
    );

    await run.invite.start();
    await run.invite.join();

    expect(run.invite.state()).toEqual({ step: "failed", failure: { kind: "removed" } });
  });

  it("a deleted account (410) leaves the session and asks nothing more", async () => {
    const run = page(`#${TOKEN}`, [json(410, {})], signedIn);

    await run.invite.start();

    expect(run.log).toContain("signOut");
    expect(run.requests).toHaveLength(1);
    expect(run.invite.state()).toEqual({
      step: "idle",
      signedIn: false,
      failure: { kind: "accountDeleted" },
    });
  });

  it("no connection on the accept keeps the preview, to try again", async () => {
    const run = page(`#${TOKEN}`, [json(200, {}), json(200, PREVIEW)], signedIn);

    await run.invite.start();
    await run.invite.join();

    expect(run.invite.state()).toEqual({
      step: "preview",
      preview: PREVIEW,
      failure: { kind: "offline" },
    });
  });
});
