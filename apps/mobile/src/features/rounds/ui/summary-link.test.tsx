import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";

import type { Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { attendanceRound } from "../model/attendance.test.fixture";
import { summaryHref } from "../navigation";
import { SummaryLink } from "./SummaryLink";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("../../../ui/Button", () => ({ Button: () => null }));

const AUTO_END_MS = 6 * 3_600_000;
const GROUP = "g0000000-0000-4000-8000-000000000001";

function roundStartingAt(startsAt: string): Round {
  return {
    ...attendanceRound(),
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + AUTO_END_MS).toISOString(),
  };
}

describe("SummaryLink (screens 06 and 26)", () => {
  const started = roundStartingAt("2026-11-10T10:00:00Z");
  const now = Date.parse("2026-11-10T12:00:00Z");

  test("after the start it opens the summary of the round", () => {
    const element = SummaryLink({ groupId: GROUP, round: started, now }) as ReactElement<{
      label: string;
      onPress: () => void;
    }>;
    expect(element.props.label).toBe(strings.rounds.detail.summaryLink);
    element.props.onPress();
    expect(router.push).toHaveBeenCalledWith(summaryHref(GROUP, started.roundId));
  });

  test("before the start there is no link", () => {
    expect(
      SummaryLink({ groupId: GROUP, round: started, now: Date.parse("2026-11-10T09:00:00Z") }),
    ).toBeNull();
  });

  test("a round that is over has no link: screens 06 and 26 offer 'Ver resumo' then (R99)", () => {
    const closedEarly: Round = { ...started, endsAt: "2026-11-10T11:00:00Z" };
    expect(SummaryLink({ groupId: GROUP, round: closedEarly, now })).toBeNull();
    const closedBeforeStart: Round = { ...started, endsAt: "2026-11-10T08:00:00Z" };
    expect(
      SummaryLink({
        groupId: GROUP,
        round: closedBeforeStart,
        now: Date.parse("2026-11-10T09:00:00Z"),
      }),
    ).toBeNull();
  });

  test("a canceled round has no link", () => {
    const canceled: Round = { ...started, status: "canceled" };
    expect(SummaryLink({ groupId: GROUP, round: canceled, now })).toBeNull();
  });
});
