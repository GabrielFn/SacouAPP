import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  type GroupSettings,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { errorTextOf } from "../../../services/api/api-error-text";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { Member, Round, RoundSummary } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { afterCreateGroupHref } from "../../groups/navigation";
import { withLeaf } from "../../groups/model/settings-patch";
import { canDraw } from "../../draw/model/can-draw";
import { createRoundHref, PENDING_ROUND_SCREENS, roundHref } from "../navigation";
import { createRoundMutation, roundScope } from "../queries/round-mutations";
import { hasRoundLayer, roundChips, sourceReader } from "./round-chips";
import {
  footerActions,
  roundFooterActions,
  managesRounds,
  roleHeader,
  roundSettingsOf,
  roundSubtitle,
  statsCells,
} from "./round-detail";
import { rosterOf, waitlistLine } from "./roster";
import { hasUpcomingSeries } from "./round-series";

const GROUP = "g1";
const ROUND_ID = "r1";

const LEAVES: readonly (readonly [SettingsPath, SettingsValue])[] = [
  ["attendance.enabled", true],
  ["attendance.waitlistEnabled", true],
  ["scoring.enabled", true],
  ["scoring.bestOf", 3],
  ["scoring.pointsPerSet", 25],
  ["queue.enabled", true],
  ["queue.exitMode", "automatic"],
  ["format.modality", "indoor-6x6"],
];

function resolved(): GroupSettings {
  const base = applyTemplate(defaultGroupSettings(), getSettingsTemplate("racha-organizado"));
  return LEAVES.reduce((settings, [path, value]) => withLeaf(settings, path, value), base);
}

function roundOf(patch: Partial<Round> = {}): Round {
  return {
    roundId: ROUND_ID,
    seriesId: null,
    localDate: "2026-11-03",
    localTime: "20:30",
    timeZone: "America/Sao_Paulo",
    startsAt: "2026-11-03T23:30:00Z",
    closedAt: null,
    endsAt: "2026-11-03T23:30:00Z",
    dropInOpensAt: null,
    venue: "Ginásio Sesc",
    status: "scheduled",
    settings: {
      schemaVersion: 1,
      layer: { schemaVersion: 1, scoring: { bestOf: 3 } },
      resolved: resolved(),
      sources: { "scoring.bestOf": "round", "scoring.pointsPerSet": "group" },
    },
    capacity: 14,
    goingCount: 14,
    waitlistCount: 2,
    going: [],
    waitlist: [
      { memberId: "m-clara", memberType: "dropIn", position: 1 },
      { memberId: "m-igor", memberType: "dropIn", position: 2 },
    ],
    me: { memberId: "m-me", status: null, position: null, regularPosition: null },
    ...patch,
  };
}

function memberOf(memberId: string, nickname: string | null): Member {
  return {
    memberId,
    role: "player",
    memberType: "dropIn",
    hasAccount: true,
    isMe: false,
    joinedAt: "2026-10-01T00:00:00Z",
    nickname,
    primaryPosition: null,
    otherPositions: [],
  };
}

describe("the pills of 'Como vai ser'", () => {
  const settings = roundSettingsOf(roundOf());

  test("the canvas round reads 6x6, 25 pontos, Melhor de 3 (highlighted), Perde sai, Saída parcial", () => {
    if (settings === null) throw new Error("settings did not parse");
    const chips = roundChips(settings.values, sourceReader(settings.sources), {
      withRotation: true,
    });
    expect(chips.map((chip) => [chip.label, chip.highlighted])).toEqual([
      ["6x6", false],
      ["25 pontos", false],
      ["Melhor de 3", true],
      ["Perde sai", false],
      ["Saída parcial", false],
      ["Livre / 6x0", false],
    ]);
    expect(chips.some((chip) => chip.label.includes("R$"))).toBe(false);
  });

  test("the legend shows only when the round set some leaf of its own", () => {
    expect(hasRoundLayer({ "scoring.bestOf": "round" })).toBe(true);
    expect(hasRoundLayer({ "scoring.bestOf": "group" })).toBe(false);
  });

  test("one set reads '1 set' and a whole-team exit has no partial pill", () => {
    const group = withLeaf(
      withLeaf(resolved(), "scoring.bestOf", 1),
      "queue.exitMode",
      "whole-team",
    );
    const labels = roundChips(group, () => undefined, { withRotation: false }).map((c) => c.label);
    expect(labels).toEqual(["6x6", "25 pontos", "1 set", "Perde sai"]);
  });

  test("a rotation set only for this round shows with the orange dot (R98 part 3)", () => {
    const chips = roundChips(
      resolved(),
      (path) => (path === "rotation.system" ? "round" : "group"),
      {
        withRotation: true,
      },
    );
    expect(chips.find((chip) => chip.key === "rotation")).toMatchObject({
      label: "5x1",
      highlighted: true,
    });
  });

  test("with the rotation off there is no rotation pill", () => {
    const off = withLeaf(resolved(), "rotation.enabled", false);
    const chips = roundChips(off, () => undefined, { withRotation: true });
    expect(chips.some((chip) => chip.key === "rotation")).toBe(false);
  });
});

describe("the dark panel", () => {
  const group = resolved();

  test("one confirmed without a limit reads in the singular", () => {
    const [cell] = statsCells(roundOf({ capacity: null, goingCount: 1 }), group);
    expect(cell).toMatchObject({ value: "1", label: "confirmado" });
  });

  test("14 of 14 and 2 waiting: only two cells, none about money", () => {
    const cells = statsCells(roundOf(), group);
    expect(cells).toEqual([
      { value: "14/14", label: "confirmados", amount: 14 },
      { value: "2", label: "na espera", amount: 2 },
    ]);
  });

  test("without a limit it says only how many are in", () => {
    expect(statsCells(roundOf({ capacity: null, goingCount: 14 }), group)[0]?.value).toBe("14");
  });

  test("with the waitlist off there is no second cell", () => {
    const off = withLeaf(group, "attendance.waitlistEnabled", false);
    expect(statsCells(roundOf(), off)).toHaveLength(1);
  });

  test("with the attendance off there is no panel", () => {
    const off = withLeaf(group, "attendance.enabled", false);
    expect(statsCells(roundOf(), off)).toEqual([]);
  });

  test("the subtitle has the date, the hour and the venue", () => {
    expect(roundSubtitle(roundOf())).toBe("Ter 3/11 · 20h30 · Ginásio Sesc");
    expect(roundSubtitle(roundOf({ venue: "" }))).toBe("Ter 3/11 · 20h30");
  });
});

describe("the waitlist line", () => {
  const members = [memberOf("m-clara", "Clara"), memberOf("m-igor", "Igor")];
  const place = (memberId: string, position: number) => ({ memberId, position });

  test("nobody waiting: nothing to show", () => {
    expect(waitlistLine([])).toBe("");
  });

  test("two waiting: '1º Clara · 2º Igor'", () => {
    expect(waitlistLine(rosterOf(roundOf().waitlist, members))).toBe("1º Clara · 2º Igor");
  });

  test("five waiting: three names and '+2'", () => {
    const entries = [1, 2, 3, 4, 5].map((n) => place(`m${String(n)}`, n));
    const names = entries.map((entry) => memberOf(entry.memberId, `P${String(entry.position)}`));
    expect(waitlistLine(rosterOf(entries, names))).toBe("1º P1 · 2º P2 · 3º P3 +2");
  });

  test("a member without nickname, or who left, reads 'Sem apelido'", () => {
    expect(waitlistLine(rosterOf([place("m-x", 1)], [memberOf("m-x", null)]))).toBe(
      "1º Sem apelido",
    );
    expect(waitlistLine(rosterOf([place("gone", 1)], []))).toBe("1º Sem apelido");
  });
});

describe("one route for every role", () => {
  test("admin and co-admin manage; scorekeeper and player do not", () => {
    expect(managesRounds("admin")).toBe(true);
    expect(managesRounds("coAdmin")).toBe(true);
    expect(managesRounds("scorekeeper")).toBe(false);
    expect(managesRounds("player")).toBe(false);
  });

  test.each(["admin", "coAdmin", "scorekeeper", "player"] as const)(
    "'Sortear times' (only on the manager's screen) follows who draws: %s",
    (role) => {
      // Screen 26 has no footer, so a role that does not manage never sees the button (E4.7, D1).
      expect(managesRounds(role)).toBe(canDraw(role));
    },
  );

  test("the header names the role", () => {
    expect(roleHeader("admin")).toBe("Você é admin");
    expect(roleHeader("coAdmin")).toBe("Você é co-admin");
    expect(roleHeader("player")).toBe("Você é jogador");
    expect(roleHeader("scorekeeper")).toBe("Você é placar");
  });

  test("with the pre-game built (E4.7 part 2) nothing is pending: court and draw", () => {
    expect(PENDING_ROUND_SCREENS).toEqual([]);
    expect(footerActions(PENDING_ROUND_SCREENS, false)).toEqual(["court", "draw"]);
  });

  test("'Abrir quadra' only with a court of the round; 'Sortear times' only for who draws (D1)", () => {
    const all = footerActions(PENDING_ROUND_SCREENS, false);
    expect(roundFooterActions(all, true, false)).toEqual(["draw"]);
    expect(roundFooterActions(all, true, true)).toEqual(["court", "draw"]);
    expect(roundFooterActions(all, false, true)).toEqual(["court"]);
    expect(roundFooterActions(all, false, false)).toEqual([]);
  });

  test("taking 'draw' out of the pending list shows 'Sortear times'", () => {
    expect(footerActions(["court"], false)).toEqual(["draw"]);
  });

  test("a canceled round has no actions", () => {
    expect(footerActions([], true)).toEqual([]);
  });

  test("a resolved document the parser refuses draws nothing", () => {
    const broken = roundOf({ settings: { ...roundOf().settings, resolved: { nope: 1 } } });
    expect(roundSettingsOf(broken)).toBeNull();
  });
});

describe("navigation", () => {
  test("'Criar grupo' ends on the new round of that group", () => {
    expect(afterCreateGroupHref("g1")).toEqual(createRoundHref("g1"));
    expect(roundHref("g1", "r1")).toEqual({
      pathname: "/groups/[groupId]/rounds/[roundId]",
      params: { groupId: "g1", roundId: "r1" },
    });
  });
});

describe("a weekly series already there", () => {
  const NOW = Date.parse("2026-11-02T12:00:00Z");
  const summary = (patch: Partial<RoundSummary>): RoundSummary => ({
    roundId: "x",
    seriesId: null,
    localDate: "2026-11-03",
    localTime: "20:30",
    startsAt: "2026-11-03T23:30:00Z",
    endsAt: "2026-11-04T05:30:00Z",
    venue: "",
    status: "scheduled",
    capacity: null,
    goingCount: 0,
    waitlistCount: 0,
    me: { status: null, position: null },
    ...patch,
  });

  test("an upcoming round with a seriesId means the group already repeats", () => {
    expect(hasUpcomingSeries([summary({ seriesId: "s1" })], NOW)).toBe(true);
  });

  test("no series, a canceled one or one in the past does not", () => {
    expect(hasUpcomingSeries([summary({})], NOW)).toBe(false);
    expect(hasUpcomingSeries([summary({ seriesId: "s1", status: "canceled" })], NOW)).toBe(false);
    expect(
      hasUpcomingSeries([summary({ seriesId: "s1", startsAt: "2026-10-27T23:30:00Z" })], NOW),
    ).toBe(false);
  });
});

describe("publishing with the fake API", () => {
  const body = {
    localDate: "2026-11-03",
    localTime: "20:30",
    venue: "Ginásio Sesc",
    settings: null,
    repeatWeekly: true,
  };

  test("one createRound with the exact body; success fills the detail and refreshes the list", async () => {
    const fake = createFakeSacouApi();
    const client = new QueryClient();
    client.setQueryData(queryKeys.rounds(GROUP), []);
    fake.respond("createRound", apiOk(roundOf()));
    const options = createRoundMutation(fake.api, client, GROUP);

    const created = await options.mutationFn(body);
    options.onSuccess(created);

    expect(fake.calls()).toEqual([{ operation: "createRound", args: [GROUP, body] }]);
    expect(client.getQueryData(queryKeys.round(GROUP, ROUND_ID))).toEqual(roundOf());
    expect(client.getQueryState(queryKeys.rounds(GROUP))?.isInvalidated).toBe(true);
  });

  test("the round limit reads as text and nothing is cached", async () => {
    const fake = createFakeSacouApi();
    const client = new QueryClient();
    fake.respond(
      "createRound",
      apiErr({ kind: "problem", status: 409, code: "sessions.round-limit" }),
    );
    const options = createRoundMutation(fake.api, client, GROUP);

    const failure = await options.mutationFn(body).catch((error: unknown) => error);

    expect(errorTextOf(failure)).toBe(
      "O grupo já tem rodadas demais marcadas. Cancele uma antes de criar outra.",
    );
    expect(client.getQueryData(queryKeys.round(GROUP, ROUND_ID))).toBeUndefined();
  });

  test("without a network the text is 'Sem conexão.' and nothing is cached", async () => {
    const fake = createFakeSacouApi();
    const client = new QueryClient();
    fake.respond("createRound", apiErr({ kind: "offline" }));
    const failure = await createRoundMutation(fake.api, client, GROUP)
      .mutationFn(body)
      .catch((error: unknown) => error);
    expect(errorTextOf(failure)).toBe("Sem conexão.");
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  test("the queue of a round is named by its id", () => {
    expect(roundScope("r1")).toEqual({ id: "round:r1" });
  });
});
