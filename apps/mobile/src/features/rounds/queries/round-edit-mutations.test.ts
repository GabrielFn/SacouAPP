import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { errorTextOf } from "../../../services/api/api-error-text";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { queryKeys } from "../../../services/query/query-keys";
import { attendanceRound } from "../model/attendance.test.fixture";
import { updateRoundMutation } from "./round-mutations";

const GROUP = "g1";
const ROUND = "r1";
const BODY = { localDate: "2026-11-10", localTime: "20:30", venue: "Sesc", settings: {} };

function seeded(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(queryKeys.group(GROUP), { groupId: GROUP });
  client.setQueryData(queryKeys.round(GROUP, ROUND), attendanceRound());
  client.setQueryData(queryKeys.rounds(GROUP), []);
  return client;
}

const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true;

function observe(client: QueryClient, fake: ReturnType<typeof createFakeSacouApi>) {
  return new MutationObserver(client, updateRoundMutation(fake.api, client, GROUP, ROUND));
}

describe("Salvar of Editar rodada", () => {
  test("sends one PATCH with the body; the answer replaces the detail and the list is read again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    const saved = attendanceRound({ localDate: "2026-11-10", venue: "Sesc" });
    fake.respond("updateRound", apiOk(saved));

    await observe(client, fake).mutate(BODY);

    expect(fake.calls()).toEqual([{ operation: "updateRound", args: [GROUP, ROUND, BODY] }]);
    expect(client.getQueryData(queryKeys.round(GROUP, ROUND))).toEqual(saved);
    expect(invalidated(client, queryKeys.rounds(GROUP))).toBe(true);
  });

  test("round-date-taken reads as text and the round is read again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond(
      "updateRound",
      apiErr({ kind: "problem", status: 409, code: "sessions.round-date-taken" }),
    );
    const failure = await observe(client, fake)
      .mutate(BODY)
      .catch((error: unknown) => error);
    expect(errorTextOf(failure)).toBe(
      "Essa repetição já tem uma rodada nesse dia. Escolha outra data.",
    );
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(true);
  });

  test("a 403 reads the group and its role again", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("updateRound", apiErr({ kind: "problem", status: 403, code: "groups.forbidden" }));
    await observe(client, fake)
      .mutate(BODY)
      .catch(() => undefined);
    expect(invalidated(client, queryKeys.group(GROUP))).toBe(true);
  });

  test("offline changes nothing in the cache", async () => {
    const fake = createFakeSacouApi();
    const client = seeded();
    fake.respond("updateRound", apiErr({ kind: "offline" }));
    await observe(client, fake)
      .mutate(BODY)
      .catch(() => undefined);
    expect(invalidated(client, queryKeys.round(GROUP, ROUND))).toBe(false);
    expect(client.getQueryData(queryKeys.round(GROUP, ROUND))).toEqual(attendanceRound());
  });
});
