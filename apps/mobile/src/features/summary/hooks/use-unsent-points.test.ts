import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, test, vi } from "vitest";

import { unsentPointsQuery } from "./use-unsent-points";

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("the unsent points query (E4.12)", () => {
  test("offline it still counts, because the log is local", async () => {
    onlineManager.setOnline(false);
    const countUnsentOfRound = vi.fn(() => Promise.resolve({ events: 3, points: 3 }));
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      unsentPointsQuery({ countUnsentOfRound }, "round-1"),
    );
    const unsubscribe = observer.subscribe(() => undefined);

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe(3);
    });
    expect(observer.getCurrentResult().fetchStatus).not.toBe("paused");
    unsubscribe();
  });
});
