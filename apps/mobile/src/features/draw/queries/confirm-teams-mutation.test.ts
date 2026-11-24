import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { Round } from "../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { RESERVES, TEAM_A, TEAM_B, g1Round } from "../model/draw.test.fixture";
import { confirmTeamsMutation } from "./confirm-teams-mutation";
import { drawScope } from "./draw-mutation";

const GROUP = "g1";
const ROUND = "r1";
const BODY = { teams: [[...TEAM_A], [...TEAM_B]], reserves: [...RESERVES] };

function setup() {
  const fake = createFakeSacouApi();
  const client = createSacouQueryClient();
  client.setQueryData(queryKeys.round(GROUP, ROUND), g1Round());
  const options = confirmTeamsMutation(fake.api, client, GROUP, ROUND);
  const observer = new MutationObserver(client, { ...options, retry: false });
  return { fake, client, observer, options };
}

describe("the publication of the teams (R100)", () => {
  test("shares the queue of the draw, so it never crosses a redraw", () => {
    expect(setup().options.scope).toEqual(drawScope(ROUND));
  });

  test("puts the answered round in the cache: screens 26 and 06 show the teams with no read (case 19)", async () => {
    const { fake, client, observer } = setup();
    const answered: Round = g1Round(undefined, {
      teams: {
        confirmedAt: "2026-11-05T22:42:00Z",
        teams: [
          { number: 1, memberIds: [...TEAM_A] },
          { number: 2, memberIds: [...TEAM_B] },
        ],
        reserves: [...RESERVES],
      },
    });
    fake.respond("confirmTeams", apiOk(answered));

    await observer.mutate(BODY);

    expect(fake.calls()).toEqual([{ operation: "confirmTeams", args: [GROUP, ROUND, BODY] }]);
    expect(client.getQueryData<Round>(queryKeys.round(GROUP, ROUND))?.teams).toEqual(
      answered.teams,
    );
  });

  test("a failure is only the status of the mutation: the cached round stays", async () => {
    const { fake, client, observer } = setup();
    fake.respond("confirmTeams", apiErr({ kind: "offline" }));

    await observer.mutate(BODY).catch(() => undefined);

    expect(observer.getCurrentResult().isError).toBe(true);
    expect(client.getQueryData<Round>(queryKeys.round(GROUP, ROUND))?.teams).toBeNull();
  });

  test("a 409 of an ended or cancelled round is only isError and the queue is not stuck (R100, finding 3)", async () => {
    const { fake, client, observer } = setup();
    fake.respond(
      "confirmTeams",
      apiErr({ kind: "problem", status: 409, code: "rounds.round-not-open" }),
    );

    await observer.mutate(BODY).catch(() => undefined);

    expect(observer.getCurrentResult().isError).toBe(true);
    expect(client.getQueryData<Round>(queryKeys.round(GROUP, ROUND))?.teams).toBeNull();

    const answered: Round = g1Round(undefined, {
      teams: {
        confirmedAt: "2026-11-05T22:42:00Z",
        teams: [{ number: 1, memberIds: [...TEAM_A] }],
        reserves: [],
      },
    });
    fake.respond("confirmTeams", apiOk(answered));
    await observer.mutate(BODY);

    expect(observer.getCurrentResult().isError).toBe(false);
    expect(fake.calls()).toHaveLength(2);
    expect(client.getQueryData<Round>(queryKeys.round(GROUP, ROUND))?.teams).toEqual(
      answered.teams,
    );
  });
});
