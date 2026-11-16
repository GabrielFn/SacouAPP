import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { errorTextOf } from "../../../services/api/api-error-text";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { AddGuestBody } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { addGuestMutation, guestRefusedEffects } from "../queries/guest-mutations";
import { addPlayerHref } from "../navigation";
import {
  addPlayerReducer,
  initialAddPlayerState,
  type AddPlayerAction,
  type AddPlayerState,
} from "./add-player.reducer";
import { addableMembers } from "./addable-members";
import { attendanceRound, memberOf } from "./attendance.test.fixture";
import { addGuestBody, guestLevelText, guestNameError } from "./guest-form";

const GROUP = "g1";
const ROUND = "r1";
const GUEST = "m-duda";

function run(...actions: AddPlayerAction[]): AddPlayerState {
  return actions.reduce(addPlayerReducer, initialAddPlayerState);
}

function opened(requestId = "req-1"): AddPlayerState {
  return run({ type: "guest-name-changed", name: "Duda" }, { type: "guest-opened", requestId });
}

function bodyOf(state: AddPlayerState): AddGuestBody {
  const sheet = state.guestSheet;
  if (sheet.kind !== "open") throw new Error("the sheet is closed");
  return addGuestBody(state.guestName, sheet);
}

describe("the reducer of screen 21 and its sheet 21a", () => {
  test("the requestId is born on opening and kept until closing", () => {
    const ids = createSequentialIdGenerator();
    const first = run({ type: "guest-opened", requestId: ids.newId() });
    const again = addPlayerReducer(first, { type: "guest-opened", requestId: ids.newId() });
    expect(again.guestSheet).toEqual(first.guestSheet);
    const reopened = run(
      { type: "guest-opened", requestId: ids.newId() },
      { type: "guest-closed" },
      { type: "guest-opened", requestId: "another" },
    );
    expect(reopened.guestSheet).toMatchObject({ requestId: "another" });
  });

  test("touching Ponteiro marks it; touching it again leaves the position empty", () => {
    const marked = addPlayerReducer(opened(), {
      type: "guest-position-toggled",
      position: "outsideHitter",
    });
    expect(bodyOf(marked).primaryPosition).toBe("outsideHitter");
    const cleared = addPlayerReducer(marked, {
      type: "guest-position-toggled",
      position: "outsideHitter",
    });
    expect(bodyOf(cleared).primaryPosition).toBeNull();
  });

  test("no level sends null (the draw uses 3,0); 3,5 sends 3.5", () => {
    expect(bodyOf(opened())).toEqual({
      requestId: "req-1",
      name: "Duda",
      primaryPosition: null,
      level: null,
    });
    expect(guestLevelText(null)).toBe("3,0 · definir");
    const set = [
      { type: "guest-level-opened" },
      { type: "guest-level-drafted", tenths: 35 },
      { type: "guest-level-set", tenths: 35 },
    ] as const;
    const withLevel = set.reduce(addPlayerReducer, opened());
    expect(bodyOf(withLevel).level).toBe(3.5);
    expect(guestLevelText(35)).toBe("3,5");
  });

  test("Agora não in the level step throws the draft away and goes back to the form", () => {
    const drafted = [
      { type: "guest-level-opened" },
      { type: "guest-level-drafted", tenths: 45 },
      { type: "guest-level-closed" },
    ] as const;
    const back = drafted.reduce(addPlayerReducer, opened());
    expect(back.guestSheet).toMatchObject({ step: "form", level: null });
  });

  test("closing forgets the level; adding forgets the name and keeps only IDs", () => {
    const withLevel = addPlayerReducer(opened(), { type: "guest-level-set", tenths: 40 });
    expect(addPlayerReducer(withLevel, { type: "guest-closed" }).guestSheet).toEqual({
      kind: "closed",
    });
    const answer = { status: "going" as const, position: 13 };
    const added = addPlayerReducer(withLevel, {
      type: "guest-added",
      guest: { memberId: GUEST, answer },
    });
    expect(added).toEqual({
      guestName: "",
      guestSheet: { kind: "closed" },
      lastGuest: { memberId: GUEST, answer },
    });
    expect(JSON.stringify(added)).not.toContain("Duda");
  });

  test("the guest fields do nothing with the sheet closed", () => {
    const closed = run({ type: "guest-position-toggled", position: "libero" });
    expect(closed).toEqual(initialAddPlayerState);
  });

  test("a new action without a case does not compile", () => {
    // @ts-expect-error: an action the reducer does not know.
    const unknown: AddPlayerAction = { type: "guest-claimed" };
    expect(unknown.type).toBe("guest-claimed");
  });
});

describe("the name of the guest (PersonName, ADR 0053)", () => {
  test.each([
    ["", "Escreva o nome ou apelido do convidado."],
    ["   ", "Escreva o nome ou apelido do convidado."],
    ["...", "Use só letras, números e símbolos comuns, em até 20 caracteres."],
    ["Du‮da", "Use só letras, números e símbolos comuns, em até 20 caracteres."],
    ["Du​da", "Use só letras, números e símbolos comuns, em até 20 caracteres."],
    ["a".repeat(21), "Use só letras, números e símbolos comuns, em até 20 caracteres."],
  ])("%j is refused", (name, text) => {
    expect(guestNameError(name)).toBe(text);
  });

  test.each(["Duda", "a".repeat(20), "João 🏐", "  Duda  "])("%j passes", (name) => {
    expect(guestNameError(name)).toBeNull();
  });

  test("the name goes trimmed and in NFC", () => {
    const state = run(
      { type: "guest-name-changed", name: "  João " },
      { type: "guest-opened", requestId: "r" },
    );
    expect(bodyOf(state).name).toBe("João");
  });

  test("the route of screen 21 carries only IDs", () => {
    expect(JSON.stringify(addPlayerHref(GROUP, ROUND))).not.toContain("Duda");
  });
});

function seeded(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(queryKeys.round(GROUP, ROUND), attendanceRound());
  client.setQueryData(queryKeys.members(GROUP), []);
  client.setQueryData(queryKeys.rounds(GROUP), []);
  return client;
}

const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true;

describe("Adicionar à rodada (two calls, ADR 0053 D4)", () => {
  const body = bodyOf(opened());

  test("creates the guest, then puts it on the list; members and round are read again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("addGuest", apiOk({ memberId: GUEST }));
    fake.respond("setMemberAttendance", apiOk({ status: "going", position: 13 }));
    const observer = new MutationObserver(client, addGuestMutation(fake.api, client, GROUP, ROUND));

    const added = await observer.mutate(body);

    expect(added).toEqual({ memberId: GUEST, answer: { status: "going", position: 13 } });
    expect(fake.calls()).toEqual([
      { operation: "addGuest", args: [GROUP, body] },
      {
        operation: "setMemberAttendance",
        args: [{ groupId: GROUP, roundId: ROUND, memberId: GUEST }, "going"],
      },
    ]);
    expect(invalidated(client, queryKeys.members(GROUP))).toBe(true);
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(true);
  });

  test("a dropped network and a second try send the same requestId", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    const options = addGuestMutation(fake.api, client, GROUP, ROUND);
    fake.respond("addGuest", apiErr({ kind: "offline" }));
    await new MutationObserver(client, options).mutate(body).catch(() => undefined);
    fake.respond("addGuest", apiOk({ memberId: GUEST }));
    fake.respond("setMemberAttendance", apiOk({ status: "going", position: 13 }));
    await new MutationObserver(client, options).mutate(body);
    const sent = fake
      .calls()
      .filter((call) => call.operation === "addGuest")
      .map((call) => (call.args[1] as AddGuestBody).requestId);
    expect(sent).toEqual(["req-1", "req-1"]);
  });

  test("a refused name reads as text; a refusal after the guest exists reads the members again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond(
      "addGuest",
      apiErr({ kind: "problem", status: 400, code: "groups.guest-name-invalid" }),
    );
    const failure = await new MutationObserver(
      client,
      addGuestMutation(fake.api, client, GROUP, ROUND),
    )
      .mutate(body)
      .catch((error: unknown) => error);
    expect(errorTextOf(failure)).toBe("Escreva o nome ou apelido do convidado, com até 20 letras.");
    expect(invalidated(client, queryKeys.members(GROUP))).toBe(true);
    expect(guestRefusedEffects(GROUP, ROUND, new Error("offline"))).toEqual([]);
  });

  test("the level never goes to a query key", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("addGuest", apiOk({ memberId: GUEST }));
    fake.respond("setMemberAttendance", apiOk({ status: "going", position: 13 }));
    await new MutationObserver(client, addGuestMutation(fake.api, client, GROUP, ROUND)).mutate({
      ...body,
      level: 3.5,
    });
    const keys = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    );
    expect(keys).not.toContain("3.5");
    expect(keys).not.toContain("Duda");
  });

  test("a guest added before shows on the 21 of another round as Sem conta", () => {
    const duda = { ...memberOf(GUEST, "Duda"), hasAccount: false, memberType: "dropIn" as const };
    const rows = addableMembers([duda], attendanceRound({ roundId: "r2" }), "");
    expect(rows).toMatchObject([{ memberId: GUEST, name: "Duda", detail: "Sem conta" }]);
  });
});
