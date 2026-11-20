import { describe, expect, test } from "vitest";

import { addableMembers, normalizedSearch } from "./addable-members";
import {
  attendanceRound,
  attendanceSettings,
  BEFORE,
  goingOf,
  ME,
  memberOf,
  waitOf,
} from "./attendance.test.fixture";
import { capacityHint } from "./capacity-hint";
import { confirmedSummary, summaryText } from "./confirmed-summary";
import { presenceCard, presenceCounts, type PresenceInput } from "./presence-card";
import { dropInOpensLabel } from "./round-clock";
import { roundListText } from "./round-list-text";
import {
  initialRoundScreenState,
  roundScreenReducer,
  type RoundScreenAction,
} from "./round-screen.reducer";
import { rosterOf } from "./roster";

const MINUTE = 60_000;
const CLARA = { memberId: "m-clara", position: 1, name: "Clara" };

function input(patch: Partial<PresenceInput> = {}): PresenceInput {
  return {
    round: attendanceRound(),
    values: attendanceSettings(),
    waitlist: [],
    myType: "regular",
    now: BEFORE,
    ...patch,
  };
}

function full(patch: Parameters<typeof attendanceRound>[0] = {}) {
  return attendanceRound({ goingCount: 12, ...patch });
}

describe("presenceCard, one case per row of D7", () => {
  test("regular going 2nd: Você vai · 2º mensalista, with Não vou mais", () => {
    const round = attendanceRound({
      me: { memberId: ME, status: "going", position: 2, regularPosition: 2 },
      goingCount: 10,
    });
    const card = presenceCard(input({ round }));
    expect([card.title, card.line]).toEqual(["Você vai", "2º mensalista"]);
    expect(card.actions).toEqual({
      kind: "leave",
      label: "Não vou mais",
      warning: null,
      needsConfirm: false,
    });
  });

  test("drop-in going 8th: 8º da lista; promoted holds a spot too", () => {
    const me = { memberId: ME, status: "promoted" as const, position: 8, regularPosition: null };
    const card = presenceCard(input({ round: attendanceRound({ me, goingCount: 8 }) }));
    expect([card.title, card.line]).toEqual(["Você vai", "8º da lista"]);
  });

  test("waitlisted 2nd: Sair da espera, no warning nor confirmation", () => {
    const me = { memberId: ME, status: "waitlisted" as const, position: 2, regularPosition: null };
    const card = presenceCard(input({ round: full({ me }) }));
    expect([card.title, card.line]).toEqual(["Você está na espera", "2º da espera"]);
    expect(card.actions).toEqual({
      kind: "leave",
      label: "Sair da espera",
      warning: null,
      needsConfirm: false,
    });
  });

  test("no answer with 2 spots left: Faltam 2 vagas and VOU on", () => {
    const card = presenceCard(input({ round: attendanceRound({ goingCount: 10 }) }));
    expect([card.title, card.line]).toEqual(["Vai?", "Faltam 2 vagas"]);
    expect(card.actions).toEqual({ kind: "answer", canGo: true });
  });

  test("notGoing answers again like no answer", () => {
    const me = { memberId: ME, status: "notGoing" as const, position: null, regularPosition: null };
    expect(presenceCard(input({ round: attendanceRound({ me, goingCount: 11 }) })).line).toBe(
      "Falta 1 vaga",
    );
  });

  test("full with waitlist: você entra na espera, VOU on", () => {
    const card = presenceCard(input({ round: full() }));
    expect(card.line).toBe("Lista cheia: você entra na espera");
    expect(card.actions).toEqual({ kind: "answer", canGo: true });
  });

  test("full without waitlist: Lista cheia, VOU off", () => {
    const card = presenceCard(input({ round: full(), values: attendanceSettings(false) }));
    expect(card.line).toBe("Lista cheia");
    expect(card.actions).toEqual({ kind: "answer", canGo: false });
  });

  test("no limit: no line", () => {
    expect(presenceCard(input({ round: attendanceRound({ capacity: null }) })).line).toBeNull();
  });

  describe("the window of the drop-ins", () => {
    const opensAt = "2026-11-06T22:00:00Z";
    const round = attendanceRound({
      localDate: "2026-11-07",
      startsAt: "2026-11-07T22:00:00Z",
      closedAt: null,
      endsAt: "2026-11-07T22:00:00Z",
      dropInOpensAt: opensAt,
    });
    const opens = Date.parse(opensAt);

    test("one minute before: VOU off with the time, in the zone of the round", () => {
      const card = presenceCard(input({ round, myType: "dropIn", now: opens - MINUTE }));
      expect(card.line).toBe("Avulsos confirmam a partir de sex, 19h");
      expect(card.actions).toEqual({ kind: "answer", canGo: false });
    });

    test("one minute after: VOU on", () => {
      const card = presenceCard(input({ round, myType: "dropIn", now: opens + MINUTE }));
      expect(card.actions).toEqual({ kind: "answer", canGo: true });
    });

    test("a regular has no window", () => {
      const card = presenceCard(input({ round, myType: "regular", now: opens - MINUTE }));
      expect(card.actions).toEqual({ kind: "answer", canGo: true });
    });

    test("the label keeps the minutes", () => {
      expect(dropInOpensLabel(round, "2026-11-06T21:30:00Z")).toBe("sex, 18h30");
    });
  });

  test("started: the current state and no buttons", () => {
    const me = { memberId: ME, status: "going" as const, position: 3, regularPosition: null };
    const round = attendanceRound({ me, goingCount: 3 });
    const card = presenceCard(input({ round, now: Date.parse(round.startsAt) }));
    expect(card).toEqual({
      title: "Você vai",
      line: "A rodada já começou. Fale com o admin.",
      actions: { kind: "none" },
    });
  });

  test("canceled: Rodada cancelada and no buttons", () => {
    const card = presenceCard(input({ round: attendanceRound({ status: "canceled" }) }));
    expect(card).toEqual({ title: "Rodada cancelada", line: null, actions: { kind: "none" } });
  });

  test("the warning shows only with you in a spot and someone waiting", () => {
    const me = { memberId: ME, status: "going" as const, position: 5, regularPosition: null };
    const withWait = presenceCard(input({ round: full({ me }), waitlist: [CLARA] }));
    expect(withWait.actions).toEqual({
      kind: "leave",
      label: "Não vou mais",
      warning: "Clara (1º da espera) entra no seu lugar.",
      needsConfirm: true,
    });
    const notFull = presenceCard(input({ round: attendanceRound({ me, goingCount: 5 }) }));
    expect(notFull.actions).toMatchObject({ warning: null, needsConfirm: false });
    const waiting = { ...me, status: "waitlisted" as const };
    expect(
      presenceCard(input({ round: full({ me: waiting }), waitlist: [CLARA] })).actions,
    ).toMatchObject({ warning: null });
  });

  test("the counts: 12/12 and 1 na espera; the waitlist hides when empty or off", () => {
    const round = full({ waitlistCount: 1 });
    expect(presenceCounts(round, attendanceSettings())).toEqual({
      confirmed: "12/12",
      waitlist: "1 na espera",
    });
    expect(presenceCounts(round, attendanceSettings(false)).waitlist).toBeNull();
    expect(
      presenceCounts(attendanceRound({ capacity: null, goingCount: 4 }), attendanceSettings()),
    ).toEqual({ confirmed: "4", waitlist: null });
  });
});

describe("confirmedSummary", () => {
  const names = [
    "Ana",
    "Pedro",
    "Lia",
    "Marcos",
    "Bia",
    "Caio",
    "Duda",
    "Edu",
    "Você",
    "Fê",
    "Gil",
    "Hugo",
  ];
  const roster = names.map((name, index) => ({
    memberId: index === 8 ? ME : `m-${String(index)}`,
    position: index + 1,
    name,
  }));

  test("12 with you 9th: Ana, Pedro, Lia, Marcos, você e mais 7, você in bold", () => {
    const summary = confirmedSummary(roster, ME);
    expect(summaryText(summary)).toBe("Ana, Pedro, Lia, Marcos, você e mais 7");
    expect(summary.parts.filter((part) => part.strong).map((part) => part.text)).toEqual(["você"]);
    expect(summary.initials).toEqual(["A", "P", "L", "M", "V"]);
  });

  test("3 without you: Ana, Pedro e Lia", () => {
    expect(summaryText(confirmedSummary(roster.slice(0, 3), ME))).toBe("Ana, Pedro e Lia");
  });

  test("ordered by position, whatever the order of the answer", () => {
    expect(summaryText(confirmedSummary([...roster.slice(0, 2)].reverse(), ME))).toBe(
      "Ana e Pedro",
    );
  });

  test("0: Ninguém confirmou ainda", () => {
    expect(summaryText(confirmedSummary([], ME))).toBe("Ninguém confirmou ainda");
  });

  test("a member without nickname is Sem apelido", () => {
    expect(summaryText(confirmedSummary([{ memberId: "x", position: 1, name: null }], ME))).toBe(
      "Sem apelido",
    );
  });
});

describe("addableMembers", () => {
  const members = [
    memberOf("m-joao", "João"),
    memberOf("m-ana", "Ana", { memberType: "regular" }),
    memberOf("m-davi", "Davi"),
    memberOf(ME, "Eu", { memberType: "regular" }),
    memberOf("m-going", "Zeca"),
    memberOf("m-wait", "Wal"),
    memberOf("m-guest", null, { hasAccount: false }),
  ];
  const round = attendanceRound({
    going: [goingOf("m-going", 1)],
    waitlist: [waitOf("m-wait", 1)],
  });

  test("leaves out going, promoted and waitlisted; regulars first, then by name; you as Você", () => {
    const rows = addableMembers(members, round, "");
    expect(rows.map((row) => [row.name, row.detail])).toEqual([
      ["Ana", "Mensalista"],
      ["Você", "Mensalista"],
      ["Davi", "Avulso"],
      ["João", "Avulso"],
      ["Sem apelido", "Sem conta"],
    ]);
  });

  test("joao finds João; blanks show everyone", () => {
    expect(addableMembers(members, round, "joao").map((row) => row.memberId)).toEqual(["m-joao"]);
    expect(addableMembers(members, round, "  ")).toHaveLength(5);
    expect(normalizedSearch("  JOÃO ")).toBe("joao");
  });
});

describe("capacityHint", () => {
  test("12/14 with waitlist", () => {
    const round = attendanceRound({ capacity: 14, goingCount: 12 });
    expect(capacityHint(round, true)).toEqual({
      text: "Faltam 2 vagas. Quem passar de 14 entra na espera.",
      canAdd: true,
    });
  });

  test("14/14 with waitlist; without waitlist Adicionar is off; no limit is null", () => {
    const round = attendanceRound({ capacity: 14, goingCount: 14 });
    expect(capacityHint(round, true)).toEqual({
      text: "Lista cheia. Quem você adicionar entra na espera.",
      canAdd: true,
    });
    expect(capacityHint(round, false)).toEqual({ text: "Lista cheia.", canAdd: false });
    expect(capacityHint(attendanceRound({ capacity: null }), true)).toBeNull();
  });
});

describe("roundListText", () => {
  const members = [
    memberOf("m-ana", "Ana"),
    memberOf("m-pedro", "Pedro"),
    memberOf("m-clara", "Clara"),
    memberOf("m-igor", "Igor"),
  ];
  const round = attendanceRound({
    localDate: "2026-11-03",
    localTime: "20:30",
    startsAt: "2026-11-03T23:30:00Z",
    venue: "Ginásio Sesc",
    capacity: 14,
    goingCount: 3,
    waitlistCount: 2,
    going: [goingOf("m-pedro", 2), goingOf("m-ana", 1), goingOf("m-gone", 3)],
    waitlist: [waitOf("m-clara", 1), waitOf("m-igor", 2)],
  });

  test("golden: the round, the numbered confirmed and the waitlist", () => {
    expect(roundListText("Racha de terça", round, members, true)).toBe(
      [
        "Racha de terça · Ter 3/11 · 20h30 · Ginásio Sesc",
        "",
        "Confirmados (3/14)",
        "1. Ana",
        "2. Pedro",
        "3. Sem apelido",
        "",
        "Espera",
        "1. Clara",
        "2. Igor",
      ].join("\n"),
    );
  });

  test("only nicknames: no ID, no UUID, no phone", () => {
    const text = roundListText("Racha", round, members, true);
    expect(text).not.toMatch(/m-|[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  test("the waitlist hides when it is off; nobody confirmed says so", () => {
    const empty = attendanceRound({ capacity: null });
    expect(roundListText("Racha", round, members, false)).not.toContain("Espera");
    expect(roundListText("Racha", empty, members, true)).toContain(
      "Confirmados (0)\nNinguém confirmou ainda.",
    );
  });
});

describe("roundScreenReducer", () => {
  test("one sheet at a time: the confirmation of Tirar replaces the list", () => {
    const opened = roundScreenReducer(initialRoundScreenState, { type: "confirmed-opened" });
    const asked = roundScreenReducer(opened, { type: "remove-asked", memberId: "m-ana" });
    expect(asked.sheet).toEqual({ kind: "remove", memberId: "m-ana" });
    expect(roundScreenReducer(asked, { type: "sheet-closed" }).sheet).toEqual({ kind: "none" });
    expect(roundScreenReducer(initialRoundScreenState, { type: "leave-asked" }).sheet).toEqual({
      kind: "leave",
    });
    expect(roundScreenReducer(asked, { type: "list-copied" })).toEqual({
      ...asked,
      copyNote: "copied",
    });
  });

  test("the copy note shows, fails and goes away", () => {
    const copied = roundScreenReducer(initialRoundScreenState, { type: "list-copied" });
    expect(roundScreenReducer(copied, { type: "copy-note-cleared" }).copyNote).toBe("none");
    const failed = roundScreenReducer(initialRoundScreenState, { type: "copy-failed" });
    expect(failed.copyNote).toBe("failed");
    expect(roundScreenReducer(failed, { type: "copy-note-cleared" }).copyNote).toBe("none");
  });

  test("a new action without a case does not compile", () => {
    // @ts-expect-error: an action the reducer does not know.
    const unknown: RoundScreenAction = { type: "unknown-action" };
    expect(unknown.type).toBe("unknown-action");
  });

  test("rosterOf joins the names by memberId", () => {
    expect(rosterOf([waitOf("m-ana", 1)], [memberOf("m-ana", "Ana")])).toMatchObject([
      { memberId: "m-ana", position: 1, name: "Ana" },
    ]);
  });
});
