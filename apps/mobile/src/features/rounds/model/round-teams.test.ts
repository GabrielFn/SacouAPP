import { describe, expect, it } from "vitest";

import type { Round } from "../../../services/api/sacou-api";
import { G1_ORDER, RESERVES, TEAM_A, TEAM_B, g1Members } from "../../draw/model/draw.test.fixture";
import { attendanceRound, goingOf, memberOf } from "./attendance.test.fixture";
import { placementText, roundTeamsView, teamLabel } from "./round-teams";

/** 19h42 in São Paulo (UTC-3), on the day of the round of the fixture. */
const CONFIRMED_AT = "2026-11-05T22:42:00Z";

function published(teams: readonly (readonly string[])[], reserves: readonly string[]) {
  return {
    confirmedAt: CONFIRMED_AT,
    teams: teams.map((memberIds, index) => ({ number: index + 1, memberIds: [...memberIds] })),
    reserves: [...reserves],
  };
}

/** G1 of sorteio.md with the teams published, read by `me`. */
function g1(me: string, patch: Partial<Round> = {}, going: readonly string[] = G1_ORDER): Round {
  return attendanceRound({
    capacity: null,
    goingCount: going.length,
    going: going.map((memberId, index) => goingOf(memberId, index + 1)),
    me: { memberId: me, status: null, position: null, regularPosition: null },
    teams: published([TEAM_A, TEAM_B], RESERVES),
    ...patch,
  });
}

describe("roundTeamsView (R100, case 16)", () => {
  it("puts the reader of team 1 in Laranja, named 'você', with the time of the draw", () => {
    const view = roundTeamsView(g1("ana"), g1Members());

    expect(view?.me).toMatchObject({ kind: "team", team: { name: "Laranja", letter: "A" } });
    expect(placementText(view?.me ?? { kind: "none" })).toBe("Você está no Laranja");
    expect(view?.confirmedAtText).toBe("19h42");
    expect(view?.teams[0]?.names[0]).toEqual({ text: "você", me: true });
    expect(view?.reserves).toEqual(["Davi", "Sofia"]);
    expect(view?.listChanged).toBe(false);
  });

  it("puts the reader of team 2 in Azul and of team 3 in 'Time 3'", () => {
    expect(placementText(roundTeamsView(g1("rafa"), g1Members())?.me ?? { kind: "none" })).toBe(
      "Você está no Azul",
    );
    const three = g1("davi", {
      teams: published(
        [TEAM_A.slice(0, 4), TEAM_B.slice(0, 4), ["davi", "sofia", "bia", "gabi"]],
        [],
      ),
    });
    const view = roundTeamsView(three, g1Members());
    expect(placementText(view?.me ?? { kind: "none" })).toBe("Você está no Time 3");
    expect(view?.teams[2]?.identity.color).toBe("neutral");
  });

  it("gives the reserve its place in the queue", () => {
    const view = roundTeamsView(g1("sofia"), g1Members());

    expect(placementText(view?.me ?? { kind: "none" })).toBe("Você está na reserva · 2º da fila");
  });

  it("tells who confirmed after the teams, and has no line for who did not confirm", () => {
    const late = roundTeamsView(g1("clara", {}, [...G1_ORDER, "clara"]), g1Members());
    const away = roundTeamsView(g1("clara"), g1Members());

    expect(late?.me).toEqual({ kind: "late" });
    expect(placementText({ kind: "late" })).toBe(
      "Você confirmou depois dos times. Fale com quem organiza.",
    );
    expect(late?.listChanged).toBe(true);
    expect(away?.me).toEqual({ kind: "none" });
    expect(placementText({ kind: "none" })).toBeNull();
  });

  it("is null with no teams and in a cancelled round, and stays in an ended one", () => {
    expect(roundTeamsView(g1("ana", { teams: null }), g1Members())).toBeNull();
    expect(roundTeamsView(g1("ana", { status: "canceled" }), g1Members())).toBeNull();
    expect(
      roundTeamsView(g1("ana", { closedAt: CONFIRMED_AT, endsAt: CONFIRMED_AT }), g1Members()),
    ).not.toBeNull();
  });
});

describe("roundTeamsView when the list moved (R100, case 17)", () => {
  it("marks who left the round and turns listChanged on", () => {
    const view = roundTeamsView(
      g1(
        "ana",
        {},
        G1_ORDER.filter((id) => id !== "duda"),
      ),
      g1Members(),
    );

    expect(view?.teams[1]?.names[1]).toEqual({ text: "Duda (saiu)", me: false });
    expect(view?.listChanged).toBe(true);
  });

  it("calls an unknown member 'Sem apelido' and two Anas by the short names of the court", () => {
    const members = [
      ...g1Members().filter((member) => !["joao", "pedro", "ana"].includes(member.memberId)),
      memberOf("pedro", "Ana Clara"),
      memberOf("ana", "Ana Beatriz"),
    ];
    const view = roundTeamsView(g1("bia"), members);

    expect(view?.teams[0]?.names.map((name) => name.text).slice(0, 3)).toEqual([
      "Ana B.",
      "Sem apelido",
      "Ana C.",
    ]);
  });

  it("reads each team as one text", () => {
    const view = roundTeamsView(g1("bia"), g1Members());

    expect(
      teamLabel(
        view?.teams[0] ?? {
          identity: { number: 1, letter: "A", name: "", color: "orange" },
          names: [],
        },
      ),
    ).toBe("Laranja: Ana, João, Pedro, Lia, Marcos e você");
  });
});

describe("roundTeamsView with the attendance off (R100, finding 5)", () => {
  it("documents it: with an empty list everyone but the reader reads '(saiu)', the list counts as changed and the reader has no line", () => {
    const view = roundTeamsView(g1("ana", { goingCount: 0, going: [] }, []), g1Members());

    expect(view?.me).toEqual({ kind: "none" });
    expect(view?.listChanged).toBe(true);
    expect(view?.teams[0]?.names[0]?.text).toBe("você");
    expect(view?.teams[0]?.names[1]?.text).toMatch(/\(saiu\)$/);
  });
});
