import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { queryKeys } from "../../../services/query/query-keys";
import { useRoundClosed } from "./use-round-closed";

const holder = vi.hoisted(() => ({ client: null as { invalidateQueries: unknown } | null }));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQueryClient: () => holder.client,
}));
vi.mock("react", () => ({ useCallback: <T>(callback: T) => callback }));

describe("useRoundClosed (R99 S1 criterion 5, S3 criterion 12)", () => {
  test("the server closed the round: detail, summary, list and the own numbers are read again", async () => {
    const client = new QueryClient();
    holder.client = client;
    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated ?? false;
    const keys = [
      queryKeys.round("g1", "r1"),
      queryKeys.roundSummary("g1", "r1"),
      queryKeys.rounds("g1"),
      queryKeys.myStats(),
    ];
    for (const key of keys) client.setQueryData(key, {});
    const unrelated = queryKeys.members("g1");
    client.setQueryData(unrelated, []);

    useRoundClosed()({ groupId: "g1", roundId: "r1" });
    await Promise.resolve();

    for (const key of keys) expect(stale(key)).toBe(true);
    expect(stale(unrelated)).toBe(false);
  });
});
