import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeExternalLink } from "../../../adapters/fake-external-link";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createFakeShareSheet } from "../../../adapters/fake-share-sheet";
import { createMemoryInviteLinkStore } from "../../../adapters/memory-invite-link-store";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { Invite } from "../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { GROUP } from "../model/members.test.fixture";
import type { StoredInviteLink } from "../ports/invite-link-store";
import {
  inviteLinkMutation,
  openInviteLink,
  regenerateInviteLink,
  revokeListedInvite,
  sendInviteOnWhatsApp,
} from "./invite-link-flow";

const OLD: StoredInviteLink = {
  inviteId: "old",
  token: "OLD-TOKEN-0123456789-abcdefghijklmnopqrstu",
};
const NEW_TOKEN = "NEW-TOKEN-0123456789-abcdefghijklmnopqrstu";

const problem = (status: number, code: string): ApiError =>
  ({ kind: "problem", status, code }) as ApiError;

function listed(inviteId: string): Invite {
  return {
    inviteId,
    createdAt: "2026-11-10T12:00:00Z",
    createdBy: "a",
    expiresAt: null,
    useCount: 0,
  };
}

function setup(stored: StoredInviteLink | null) {
  const fake = createFakeSacouApi();
  const store = createMemoryInviteLinkStore(stored === null ? {} : { [GROUP]: stored });
  const client = createSacouQueryClient();
  fake.respond("createInvite", apiOk({ inviteId: "new", token: NEW_TOKEN, expiresAt: null }));
  fake.respond("revokeInvite", apiOk(null));
  return { fake, store, client, deps: { api: fake.api, store, client } };
}

const operations = (fake: ReturnType<typeof createFakeSacouApi>) =>
  fake.calls().map((call) => call.operation);

/** Everything the query cache holds, as text: the token must never be in it. */
function cacheText(client: ReturnType<typeof createSacouQueryClient>): string {
  return JSON.stringify(
    client
      .getQueryCache()
      .getAll()
      .map((query) => [query.queryKey, query.state.data]),
  );
}

/** Everything the mutation cache holds, as text: after the screen leaves, the token must be gone. */
function mutationCacheText(client: ReturnType<typeof createSacouQueryClient>): string {
  return JSON.stringify(
    client
      .getMutationCache()
      .getAll()
      .map((mutation) => mutation.state.data),
  );
}

/** Lets the timer of `gcTime: 0` run. */
const nextTick = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe("opening the invite of screen 19d", () => {
  test("nothing kept: creates one and keeps it", async () => {
    const { fake, store, deps } = setup(null);
    expect(await openInviteLink(deps, GROUP)).toEqual({ inviteId: "new", token: NEW_TOKEN });
    expect(operations(fake)).toEqual(["createInvite"]);
    expect(store.snapshot()[GROUP]).toEqual({ inviteId: "new", token: NEW_TOKEN });
  });

  test("kept and still listed: no new invite", async () => {
    const { fake, deps } = setup(OLD);
    fake.respond("listInvites", apiOk([listed("other"), listed("old")]));
    expect(await openInviteLink(deps, GROUP)).toEqual(OLD);
    expect(operations(fake)).toEqual(["listInvites"]);
  });

  test("kept but no longer listed: forgets it and creates another", async () => {
    const { fake, store, deps } = setup(OLD);
    fake.respond("listInvites", apiOk([listed("other")]));
    const link = await openInviteLink(deps, GROUP);
    expect(link.inviteId).toBe("new");
    expect(store.calls()).toEqual([`read:${GROUP}`, `remove:${GROUP}`, `save:${GROUP}`]);
  });

  test("the token never reaches the query cache", async () => {
    const { fake, client, deps } = setup(OLD);
    fake.respond("listInvites", apiOk([listed("other")]));
    await openInviteLink(deps, GROUP);
    const text = cacheText(client);
    expect(text).not.toContain(NEW_TOKEN);
    expect(text).not.toContain(OLD.token);
  });

  test("the mutation cache drops the token once the screen unmounts", async () => {
    const { fake, client, deps } = setup(OLD);
    fake.respond("listInvites", apiOk([listed("other")]));
    const observer = new MutationObserver(client, inviteLinkMutation(deps, GROUP));
    const unsubscribe = observer.subscribe(() => undefined);
    await observer.mutate({ kind: "open" });
    expect(mutationCacheText(client)).toContain(NEW_TOKEN);

    unsubscribe();
    await nextTick();

    expect(mutationCacheText(client)).not.toContain(NEW_TOKEN);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  test("the invite limit refuses with its text and refreshes the list", async () => {
    const { fake, client, deps } = setup(null);
    fake.respond("createInvite", apiErr(problem(409, "groups.invite-limit")));
    client.setQueryData(queryKeys.invites(GROUP), [listed("x")]);
    await expect(openInviteLink(deps, GROUP)).rejects.toMatchObject({
      apiError: { code: "groups.invite-limit" },
    });
    expect(client.getQueryState(queryKeys.invites(GROUP))?.isInvalidated).toBe(true);
  });
});

describe("Desativar este link e gerar outro", () => {
  test("revokes, forgets the copy and creates another, in this order", async () => {
    const { fake, store, deps } = setup(OLD);
    const link = await regenerateInviteLink(deps, GROUP, "old");
    expect(operations(fake)).toEqual(["revokeInvite", "createInvite"]);
    expect(fake.calls()[0]?.args).toEqual([GROUP, "old"]);
    expect(store.calls()).toEqual([`remove:${GROUP}`, `save:${GROUP}`]);
    expect(link.token).toBe(NEW_TOKEN);
  });

  test("an invite already gone on the server is not an error", async () => {
    const { fake, deps } = setup(OLD);
    fake.respond("revokeInvite", apiErr(problem(404, "groups.invite-not-found")));
    expect((await regenerateInviteLink(deps, GROUP, "old")).inviteId).toBe("new");
  });

  test("a refused revoke keeps the copy and creates nothing", async () => {
    const { fake, store, deps } = setup(OLD);
    fake.respond("revokeInvite", apiErr(problem(403, "groups.forbidden")));
    await expect(regenerateInviteLink(deps, GROUP, "old")).rejects.toBeDefined();
    expect(operations(fake)).toEqual(["revokeInvite"]);
    expect(store.snapshot()[GROUP]).toEqual(OLD);
  });
});

describe("Revogar on the invites tab", () => {
  test("revoking the kept one forgets the copy", async () => {
    const { store, deps } = setup(OLD);
    await revokeListedInvite(deps, GROUP, "old");
    expect(store.snapshot()[GROUP]).toBeUndefined();
  });

  test("revoking another one keeps the copy", async () => {
    const { store, deps } = setup(OLD);
    await revokeListedInvite(deps, GROUP, "other");
    expect(store.snapshot()[GROUP]).toEqual(OLD);
  });
});

describe("Mandar no WhatsApp", () => {
  const message = "Entra no Racha no Sacou: https://sacou.app/c#t";

  test("opens the WhatsApp app with the message", async () => {
    const link = createFakeExternalLink(true);
    const share = createFakeShareSheet();
    await sendInviteOnWhatsApp(link, share, message);
    expect(link.opened()).toEqual([`whatsapp://send?text=${encodeURIComponent(message)}`]);
    expect(share.shared()).toEqual([]);
  });

  test("without WhatsApp, the share sheet gets the same message", async () => {
    const link = createFakeExternalLink(false);
    const share = createFakeShareSheet();
    await sendInviteOnWhatsApp(link, share, message);
    expect(share.shared()).toEqual([message]);
  });
});
