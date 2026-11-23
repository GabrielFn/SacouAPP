import { describe, expect, it } from "vitest";

import type { MyGroup, RoundSummary } from "../../../services/api/sacou-api";
import { groupCardActions } from "../../groups/model/groups-list.selectors";
import {
  cardCountText,
  cardPill,
  dayStripText,
  nextRoundOf,
  nextRoundText,
  recentRoundOf,
  roundCardsOf,
  SUMMARY_CARD_WINDOW_MS,
  roundsInWindow,
  upcomingRoundsOf,
  swatchIndexOf,
  weekSummaryText,
} from "./round-cards";

const HOUR_MS = 3_600_000;

// Monday 2 November 2026, 10h local.
const AUTO_END_HOURS = 6;
const NOW = new Date(2026, 10, 2, 10, 0).getTime();

function summary(
  id: string,
  localDate: string,
  localTime: string,
  extra: Partial<RoundSummary> = {},
) {
  const [year = 0, month = 1, day = 1] = localDate.split("-").map(Number);
  const [hours = 0, minutes = 0] = localTime.split(":").map(Number);
  const round: RoundSummary = {
    roundId: id,
    seriesId: null,
    localDate,
    localTime,
    startsAt: new Date(year, month - 1, day, hours, minutes).toISOString(),
    endsAt: new Date(year, month - 1, day, hours + AUTO_END_HOURS, minutes).toISOString(),
    venue: "Ginásio Sesc",
    status: "scheduled",
    capacity: 12,
    goingCount: 9,
    waitlistCount: 0,
    me: { status: null, position: null },
  };
  return { ...round, ...extra };
}

function group(groupId: string, name: string): MyGroup {
  return { groupId, name, role: "player", memberType: "regular" };
}

const WEDNESDAY = summary("wed", "2026-11-04", "19:00");
const FRIDAY = summary("fri", "2026-11-06", "20:30");
const PAST = summary("past", "2026-10-27", "20:30");
const NEXT_WEEK = summary("next-week", "2026-11-10", "20:30");

describe("nextRoundOf", () => {
  it("shows Wednesday of a group with rounds on Wednesday and Friday", () => {
    expect(nextRoundOf([FRIDAY, WEDNESDAY, PAST], NOW)?.roundId).toBe("wed");
  });
  it("skips canceled rounds and rounds that started", () => {
    const canceled = { ...WEDNESDAY, status: "canceled" as const };
    expect(nextRoundOf([canceled, PAST], NOW)).toBeNull();
  });
});

describe("roundsInWindow", () => {
  it("counts the scheduled rounds from now to the end of Sunday, of every group", () => {
    expect(roundsInWindow([[WEDNESDAY, FRIDAY, PAST], [NEXT_WEEK]], NOW)).toBe(2);
    expect(weekSummaryText(2)).toBe("2 rodadas nos próximos 7 dias.");
    expect(weekSummaryText(1)).toBe("1 rodada nos próximos 7 dias.");
    expect(weekSummaryText(0)).toBeNull();
  });
  it("has no week cut: a Sunday shows the Monday and the Tuesday after it (R98)", () => {
    const sunday = new Date(2026, 10, 22, 10, 0).getTime();
    const monday = summary("mon", "2026-11-23", "20:00");
    const tuesday = summary("tue", "2026-11-24", "20:00");
    expect(upcomingRoundsOf([tuesday, monday], sunday).map((round) => round.roundId)).toEqual([
      "mon",
      "tue",
    ]);
    expect(roundsInWindow([[monday, tuesday]], sunday)).toBe(2);
  });
  it("includes a round exactly 7 days ahead and leaves out the one a minute later", () => {
    const edge = summary("edge", "2026-11-09", "10:00");
    const after = summary("after", "2026-11-09", "10:01");
    expect(roundsInWindow([[edge, after]], NOW)).toBe(1);
  });
  it("leaves out a canceled round, and with none in the window falls back to the next one", () => {
    const canceled = { ...WEDNESDAY, status: "canceled" as const };
    expect(roundsInWindow([[canceled]], NOW)).toBe(0);
    expect(upcomingRoundsOf([canceled, NEXT_WEEK], NOW).map((round) => round.roundId)).toEqual([
      "next-week",
    ]);
  });
  it("works on a Saturday and a Monday as well", () => {
    const saturday = new Date(2026, 10, 7, 9, 0).getTime();
    expect(roundsInWindow([[NEXT_WEEK]], saturday)).toBe(1);
    expect(roundsInWindow([[WEDNESDAY]], NOW)).toBe(1);
  });
});

describe("roundCardsOf", () => {
  it("orders the groups by their next round and puts the groups without one at the end", () => {
    const groups = [group("a", "Sem rodada"), group("b", "Sexta"), group("c", "Quarta")];
    const cards = roundCardsOf(groups, [[], [FRIDAY], [WEDNESDAY]], NOW);
    expect(cards.groups.map((entry) => entry.group.name)).toEqual([
      "Quarta",
      "Sexta",
      "Sem rodada",
    ]);
    expect(cards.groups[2]?.round).toBeNull();
    expect(cards.weekText).toBe("2 rodadas nos próximos 7 dias.");
  });
  it("marks a group whose rounds are loading or failed as unknown, not as without a round", () => {
    const cards = roundCardsOf([group("a", "A")], [undefined], NOW);
    expect(cards.groups[0]?.round).toBeNull();
    expect(cards.groups[0]?.hasNextRound).toBeNull();
    expect(cards.weekText).toBeNull();
  });
  it("knows a loaded group has no round (Criar) or has one (Editar)", () => {
    const groups = [group("a", "Sem"), group("b", "Com")];
    const cards = roundCardsOf(groups, [[], [WEDNESDAY]], NOW);
    expect(cards.groups.map((entry) => entry.hasNextRound)).toEqual([true, false]);
    const [withRound, without] = cards.groups.map((entry) =>
      groupCardActions("admin", [], entry.hasNextRound),
    );
    expect(withRound).toEqual(["members", "settings", "editRound"]);
    expect(without).toEqual(["members", "settings", "createRound"]);
  });
});

describe("cardPill", () => {
  it("says Vou with you in a place, promoted included", () => {
    expect(
      cardPill(summary("r", "2026-11-04", "19:00", { me: { status: "going", position: 3 } })),
    ).toEqual({ kind: "confirmed", label: "Vou" });
    expect(
      cardPill(summary("r", "2026-11-04", "19:00", { me: { status: "promoted", position: 12 } }))
        ?.label,
    ).toBe("Vou");
  });
  it("says Na espera · 2º in the waitlist", () => {
    const round = summary("r", "2026-11-04", "19:00", {
      me: { status: "waitlisted", position: 2 },
    });
    expect(cardPill(round)).toEqual({ kind: "waiting", label: "Na espera · 2º" });
  });
  it("says Lista cheia when you are out of a full list, and nothing otherwise", () => {
    const full = summary("r", "2026-11-04", "19:00", { goingCount: 12 });
    expect(cardPill(full)).toEqual({ kind: "going", label: "Lista cheia" });
    expect(cardPill(WEDNESDAY)).toBeNull();
    const notGoing = { ...WEDNESDAY, me: { status: "notGoing" as const, position: null } };
    expect(cardPill(notGoing)).toBeNull();
  });
});

describe("card texts", () => {
  it("counts with and without a limit and with a waitlist", () => {
    expect(cardCountText(WEDNESDAY)).toBe("9/12 confirmados");
    expect(cardCountText({ ...WEDNESDAY, capacity: null })).toBe("9 confirmados");
    expect(cardCountText({ ...WEDNESDAY, goingCount: 1, capacity: null })).toBe("1 confirmado");
    expect(cardCountText({ ...WEDNESDAY, goingCount: 0, capacity: null })).toBe("0 confirmados");
    expect(cardCountText({ ...WEDNESDAY, goingCount: 1 })).toBe("1/12 confirmados");
    expect(cardCountText({ ...WEDNESDAY, goingCount: 14, capacity: 14, waitlistCount: 2 })).toBe(
      "14/14 · 2 na espera",
    );
  });
  it("writes the day strip and the next date in the group's local date and time", () => {
    expect(dayStripText(WEDNESDAY)).toEqual({ day: "Qua", hour: "19h" });
    expect(dayStripText(FRIDAY)).toEqual({ day: "Sex", hour: "20h30" });
    expect(nextRoundText(WEDNESDAY)).toBe("Próxima: qua, 4/11");
  });
  it("keeps the same color for the same group", () => {
    const id = "6f1c2d3e-0000-4000-8000-000000000001";
    expect(swatchIndexOf(id, 3)).toBe(swatchIndexOf(id, 3));
    expect(swatchIndexOf(id, 3)).toBeLessThan(3);
    expect(swatchIndexOf(id, 0)).toBe(0);
  });
});

describe("groupCardActions with a next round", () => {
  it("offers Editar rodada with a round, Criar rodada without, only to the roles with ManageRounds", () => {
    expect(groupCardActions("admin", [], true)).toEqual(["members", "settings", "editRound"]);
    expect(groupCardActions("coAdmin", ["members", "settings"], true)).toEqual(["editRound"]);
    expect(groupCardActions("admin", [], false)).toEqual(["members", "settings", "createRound"]);
    expect(groupCardActions("coAdmin", ["members", "settings"], false)).toEqual(["createRound"]);
    expect(groupCardActions("scorekeeper", [], true)).toEqual([]);
    expect(groupCardActions("player", [], true)).toEqual([]);
  });
});

describe("recentRoundOf (question 153)", () => {
  const started = summary("tue", "2026-11-02", "08:00");
  const startMs = Date.parse(started.startsAt);

  it("offers the round from its end until 24 h after it (R97: while it is played it is live)", () => {
    const endMs = Date.parse(started.endsAt);
    expect(recentRoundOf([started], startMs)).toBeNull();
    expect(recentRoundOf([started], endMs - 1)).toBeNull();
    expect(recentRoundOf([started], endMs)?.roundId).toBe("tue");
    const lastMoment = endMs + SUMMARY_CARD_WINDOW_MS - 1;
    expect(recentRoundOf([started], lastMoment)?.roundId).toBe("tue");
    expect(recentRoundOf([started], lastMoment + 1)).toBeNull();
  });

  it("an early close shortens the window: it runs 24 h after the real endsAt", () => {
    const closedEarly = { ...started, endsAt: new Date(startMs + HOUR_MS).toISOString() };
    const lastMoment = startMs + HOUR_MS + SUMMARY_CARD_WINDOW_MS;
    expect(recentRoundOf([closedEarly], lastMoment - 1)?.roundId).toBe("tue");
    expect(recentRoundOf([closedEarly], lastMoment)).toBeNull();
  });

  it("never shows a canceled round and picks the latest one", () => {
    const canceled = summary("c", "2026-11-02", "09:00", { status: "canceled" });
    const earlier = summary("e", "2026-11-01", "20:00");
    expect(recentRoundOf([canceled], startMs + 1_000_000)).toBeNull();
    const bothEnded = Date.parse(started.endsAt) + 1;
    expect(recentRoundOf([earlier, started], bothEnded)?.roundId).toBe("tue");
  });

  it("shows up in the card of the group next to the next round", () => {
    const afterEnd = Date.parse(started.endsAt) + 60_000;
    const cards = roundCardsOf([group("a", "A")], [[started, WEDNESDAY]], afterEnd);
    expect(cards.groups[0]?.recent?.recentText).toBe("Rodada de seg, 2/11");
    expect(cards.groups[0]?.recent?.kind).toBe("recent");
    expect(cards.groups[0]?.round?.roundId).toBe("wed");
  });

  it("while it is played it is the live card, next to the next round", () => {
    const cards = roundCardsOf([group("a", "A")], [[started, WEDNESDAY]], startMs + 60_000);
    expect(cards.groups[0]?.live?.kind).toBe("live");
    expect(cards.groups[0]?.live?.nextText).toBe("Rolando agora");
    expect(cards.groups[0]?.recent).toBeNull();
    expect(cards.groups[0]?.round?.roundId).toBe("wed");
  });
});
