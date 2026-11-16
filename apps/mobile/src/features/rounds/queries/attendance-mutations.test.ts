import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { errorTextOf } from "../../../services/api/api-error-text";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { queryKeys } from "../../../services/query/query-keys";
import { addedText } from "../model/addable-members";
import { attendanceRound, memberOf } from "../model/attendance.test.fixture";
import {
  attendanceRefusedEffects,
  respondAttendanceMutation,
  setMemberAttendanceMutation,
} from "./round-mutations";

const GROUP = "g1";
const ROUND = "r1";

function seeded(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(queryKeys.round(GROUP, ROUND), attendanceRound());
  client.setQueryData(queryKeys.round(GROUP, "r2"), attendanceRound({ roundId: "r2" }));
  client.setQueryData(queryKeys.rounds(GROUP), []);
  client.setQueryData(queryKeys.members(GROUP), []);
  return client;
}

const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true;

describe("respondAttendance (screen 26)", () => {
  test("going invalidates the detail and only the list, not the other rounds", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("respondAttendance", apiOk({ status: "going", position: 3 }));
    const observer = new MutationObserver(
      client,
      respondAttendanceMutation(fake.api, client, GROUP, ROUND),
    );

    await observer.mutate("going");

    expect(fake.calls()).toEqual([
      { operation: "respondAttendance", args: [GROUP, ROUND, "going"] },
    ]);
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(true);
    expect(invalidated(client, queryKeys.rounds(GROUP))).toBe(true);
    expect(invalidated(client, queryKeys.round(GROUP, "r2"))).toBe(false);
  });

  test("two answers in a row go in order, in the queue of the round", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("respondAttendance", apiOk({ status: "going", position: 1 }));
    const options = respondAttendanceMutation(fake.api, client, GROUP, ROUND);
    expect(options.scope).toEqual({ id: "round:r1" });
    await Promise.all([
      new MutationObserver(client, options).mutate("going"),
      new MutationObserver(client, options).mutate("notGoing"),
    ]);
    expect(fake.calls().map((call) => call.args[2])).toEqual(["going", "notGoing"]);
  });

  test.each([
    ["sessions.round-full", "A rodada está cheia e a lista de espera está desligada."],
    ["sessions.round-closed", "Esta rodada não aceita mais mudanças."],
    ["sessions.drop-in-window-closed", undefined],
  ] as const)("%s reads as text and the round is read again", async (code, text) => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("respondAttendance", apiErr({ kind: "problem", status: 409, code }));
    const observer = new MutationObserver(
      client,
      respondAttendanceMutation(fake.api, client, GROUP, ROUND),
    );

    const failure = await observer.mutate("going").catch((error: unknown) => error);

    if (text !== undefined) expect(errorTextOf(failure)).toBe(text);
    expect(errorTextOf(failure)).not.toBe("");
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(true);
  });

  test("a 403 reads the group (and its role) and the round again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    client.setQueryData(queryKeys.group(GROUP), { groupId: GROUP });
    fake.respond(
      "setMemberAttendance",
      apiErr({ kind: "problem", status: 403, code: "groups.forbidden" }),
    );
    await new MutationObserver(client, setMemberAttendanceMutation(fake.api, client, GROUP, ROUND))
      .mutate({ memberId: "m-ana", response: "going" })
      .catch(() => undefined);
    expect(invalidated(client, queryKeys.group(GROUP))).toBe(true);
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(true);
  });

  test("without a network nothing is invalidated", () => {
    expect(attendanceRefusedEffects(GROUP, ROUND, new Error("x"))).toEqual([]);
  });
});

describe("setMemberAttendance (screen 21 and Tirar)", () => {
  test("adding Davi, who lands 2nd on the waitlist", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("setMemberAttendance", apiOk({ status: "waitlisted", position: 2 }));
    const observer = new MutationObserver(
      client,
      setMemberAttendanceMutation(fake.api, client, GROUP, ROUND),
    );

    const result = await observer.mutate({ memberId: "m-davi", response: "going" });

    expect(fake.calls()).toEqual([
      {
        operation: "setMemberAttendance",
        args: [{ groupId: GROUP, roundId: ROUND, memberId: "m-davi" }, "going"],
      },
    ]);
    expect(addedText(result, [memberOf("m-davi", "Davi")])).toBe("Davi entrou na espera (2º).");
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(true);
  });

  test("a spot reads as entrou na lista; you read as Você", () => {
    const answer = { status: "going" as const, position: 4 };
    const result = { memberId: "m-me", response: "going" as const, answer };
    expect(addedText(result, [memberOf("m-me", "Gabi")])).toBe("Você entrou na lista.");
  });

  test("Tirar sends notGoing for that member", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("setMemberAttendance", apiOk({ status: "notGoing", position: null }));
    await new MutationObserver(
      client,
      setMemberAttendanceMutation(fake.api, client, GROUP, ROUND),
    ).mutate({ memberId: "m-ana", response: "notGoing" });
    expect(fake.calls()[0]?.args[1]).toBe("notGoing");
  });

  test("member-not-found reads the member list again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond(
      "setMemberAttendance",
      apiErr({ kind: "problem", status: 404, code: "sessions.member-not-found" }),
    );
    await new MutationObserver(client, setMemberAttendanceMutation(fake.api, client, GROUP, ROUND))
      .mutate({ memberId: "m-gone", response: "going" })
      .catch(() => undefined);
    expect(invalidated(client, queryKeys.members(GROUP))).toBe(true);
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(false);
  });
});
