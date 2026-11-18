import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createSampleRoster } from "../features/court/dev/sample-roster";
import { SAMPLE_ORANGE_LINEUP } from "../features/court/dev/sample-match.data";
import { memberOf } from "../features/rounds/model/attendance.test.fixture";
import { queryKeys } from "../services/query/query-keys";
import { createCachedCourtRoster } from "./cached-court-roster";

const PEDRO = "a0000000-0000-4000-8000-000000000003";
const GABI = "a0000000-0000-4000-8000-000000000012";
const STRANGER = "a0000000-0000-4000-8000-000000000099";

function clientWith(): QueryClient {
  const client = new QueryClient();
  client.setQueryData(queryKeys.members("g1"), [memberOf(PEDRO, "Pedro")]);
  client.setQueryData(queryKeys.members("g2"), [memberOf(GABI, "Gabi"), memberOf(STRANGER, null)]);
  return client;
}

describe("the court roster from the members cache (D7)", () => {
  test("a name comes from the members of any group", () => {
    const roster = createCachedCourtRoster(clientWith());
    expect(roster.nameOf(PEDRO)).toBe("Pedro");
    expect(roster.nameOf(GABI)).toBe("Gabi");
  });

  test("an unknown member, or one without a nickname, gets the neutral name", () => {
    const roster = createCachedCourtRoster(clientWith());
    expect(roster.nameOf(STRANGER)).toBe("Jogador");
    expect(roster.nameOf("a0000000-0000-4000-8000-000000000098")).toBe("Jogador");
  });

  test("a cache restored from disk, with no network, still has the names", () => {
    const restored = new QueryClient();
    const roster = createCachedCourtRoster(restored);
    hydrate(restored, dehydrate(clientWith()));
    expect(roster.nameOf(PEDRO)).toBe("Pedro");
  });

  test("a new nickname in the cache changes the name", () => {
    const client = clientWith();
    const roster = createCachedCourtRoster(client);
    expect(roster.nameOf(PEDRO)).toBe("Pedro");
    client.setQueryData(queryKeys.members("g1"), [memberOf(PEDRO, "Pedrão")]);
    expect(roster.nameOf(PEDRO)).toBe("Pedrão");
  });

  test("A is orange and B blue; the dev tools add the sample names behind", () => {
    const roster = createCachedCourtRoster(clientWith(), createSampleRoster());
    expect(roster.teamAppearance("m1", "a")).toEqual({ label: "Laranja", color: "orange" });
    expect(roster.teamAppearance("m1", "b")).toEqual({ label: "Azul", color: "blue" });
    const sampleId = SAMPLE_ORANGE_LINEUP[0] ?? "";
    expect(roster.nameOf(sampleId)).toBe(createSampleRoster().nameOf(sampleId));
    expect(roster.nameOf(PEDRO)).toBe("Pedro");
  });
});
