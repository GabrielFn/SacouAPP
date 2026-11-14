import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createMemoryInviteLinkStore } from "../../../adapters/memory-invite-link-store";
import { createFakeCacheSession } from "../../../adapters/fake-cache-session";
import { clearSession } from "../../../services/session/clear-session";
import type { ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { sheetOf } from "../hooks/use-members-screen";
import { inviteViewOf } from "../hooks/use-invite-screen";
import { GROUP, member } from "../model/members.test.fixture";
import { changeRoleMutation, changeTypeMutation, leaveGroupMutation } from "./member-mutations";

const LINK = { inviteId: "i", token: "TOKEN-0123456789-abcdefghijklmnopqrstuvwxyz" };
const me = member("me", "admin", { isMe: true });
const other = member("o", "player");

function setup() {
  const fake = createFakeSacouApi();
  const store = createMemoryInviteLinkStore({ [GROUP]: LINK });
  const client = createSacouQueryClient();
  return { fake, store, client, deps: { api: fake.api, client, store } };
}

describe("writes of members", () => {
  test("demoting yourself to Placar forgets the invite kept on the phone", async () => {
    const { fake, store, client, deps } = setup();
    fake.respond("changeMemberRole", apiOk({ memberId: "me", role: "scorekeeper" }));
    const observer = new MutationObserver(client, changeRoleMutation(deps, GROUP));
    await observer.mutate({ target: me, role: "scorekeeper" });
    expect(store.snapshot()[GROUP]).toBeUndefined();
    expect(fake.calls()[0]?.args).toEqual([{ groupId: GROUP, memberId: "me" }, "scorekeeper"]);
  });

  test("becoming Co-admin keeps the invite; changing someone else keeps it too", async () => {
    const { fake, store, client, deps } = setup();
    fake.respond("changeMemberRole", apiOk({ memberId: "me", role: "coAdmin" }));
    const observer = new MutationObserver(client, changeRoleMutation(deps, GROUP));
    await observer.mutate({ target: me, role: "coAdmin" });
    await observer.mutate({ target: other, role: "scorekeeper" });
    expect(store.snapshot()[GROUP]).toEqual(LINK);
  });

  test("leaving forgets the invite and the group leaves the cache", async () => {
    const { fake, store, client, deps } = setup();
    fake.respond("leaveGroup", apiOk(null));
    client.setQueryData(queryKeys.group(GROUP), { name: "Racha" });
    const observer = new MutationObserver(client, leaveGroupMutation(deps, GROUP));
    await observer.mutate();
    expect(store.snapshot()[GROUP]).toBeUndefined();
    expect(client.getQueryData(queryKeys.group(GROUP))).toBeUndefined();
  });

  test("the last admin refusal keeps the invite and refreshes the members", async () => {
    const { fake, store, client, deps } = setup();
    const lastAdmin = { kind: "problem", status: 409, code: "groups.last-admin" } as ApiError;
    fake.respond("leaveGroup", apiErr(lastAdmin));
    client.setQueryData(queryKeys.members(GROUP), [me]);
    const observer = new MutationObserver(client, leaveGroupMutation(deps, GROUP));
    await expect(observer.mutate()).rejects.toBeDefined();
    expect(store.snapshot()[GROUP]).toEqual(LINK);
    expect(client.getQueryState(queryKeys.members(GROUP))?.isInvalidated).toBe(true);
  });

  test("a change of type sends the member and the type", async () => {
    const { fake, client, deps } = setup();
    fake.respond("changeMemberType", apiOk({ memberId: "o", memberType: "regular" }));
    const observer = new MutationObserver(client, changeTypeMutation(deps, GROUP));
    await observer.mutate({ target: other, memberType: "regular" });
    expect(fake.calls()[0]?.args).toEqual([{ groupId: GROUP, memberId: "o" }, "regular"]);
  });
});

describe("the sheet comes from the cached list", () => {
  test("a row that left the list closes the sheet", () => {
    expect(sheetOf([me, other], "o")?.target).toEqual(other);
    expect(sheetOf([me], "o")).toBeNull();
    expect(sheetOf(undefined, "o")).toBeNull();
    expect(sheetOf([me, other], null)).toBeNull();
  });
});

describe("the view of screen 19d", () => {
  const encode = (text: string) => [[text.length > 0]];

  test("without the base URL the invite is unavailable and nothing is asked", () => {
    expect(inviteViewOf({ baseUrl: null, link: LINK, failure: null, encode })).toEqual({
      kind: "unavailable",
    });
  });

  test("the view shows the short link only; the QR gets the whole one", () => {
    const encoded: string[] = [];
    const view = inviteViewOf({
      baseUrl: "https://sacou.app",
      link: LINK,
      failure: null,
      encode: (text) => {
        encoded.push(text);
        return [[true]];
      },
    });
    expect(view).toEqual({
      kind: "ready",
      invite: { shown: "sacou.app/c#TOKEN-…", matrix: [[true]] },
    });
    expect(encoded).toEqual([`https://sacou.app/c#${LINK.token}`]);
  });

  test("loading, then a failure with its text", () => {
    const base = { baseUrl: "https://sacou.app", link: undefined, encode };
    expect(inviteViewOf({ ...base, failure: null })).toEqual({ kind: "loading" });
    expect(inviteViewOf({ ...base, failure: new Error("x") }).kind).toBe("failed");
  });
});

describe("clearSession", () => {
  test("forgets the server cache and every invite link", async () => {
    const store = createMemoryInviteLinkStore({ [GROUP]: LINK, other: LINK });
    const cacheSession = createFakeCacheSession();
    await clearSession({ cacheSession, inviteLinkStore: store });
    expect(store.snapshot()).toEqual({});
    expect(store.calls()).toEqual(["clearAll"]);
    expect(cacheSession.cleared()).toBe(1);
  });
});
