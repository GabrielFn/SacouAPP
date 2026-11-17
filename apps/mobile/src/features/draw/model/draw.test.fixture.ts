import type { GroupSettings } from "@sacou/match-engine";

import type { DrawTeamsAnswer, Member, Round } from "../../../services/api/sacou-api";
import { withLeaf } from "../../groups/model/settings-patch";
import {
  attendanceRound,
  attendanceSettings,
  goingOf,
  memberOf,
} from "../../rounds/model/attendance.test.fixture";
import { drawFlowReducer, initialDrawFlowState, type DrawFlowState } from "./draw-flow.reducer";

/** The G1 scenario of `sorteio.md` (screen 07): 14 confirmed in 6x6, Davi and Sofia in the queue. */
export const G1_LEVELS: Readonly<Record<string, number>> = {
  ana: 40,
  joao: 40,
  pedro: 45,
  lia: 35,
  marcos: 30,
  bia: 35,
  rafa: 40,
  duda: 35,
  caio: 40,
  nina: 35,
  leo: 30,
  gabi: 40,
  davi: 35,
  sofia: 30,
};

const NICKNAMES: Readonly<Record<string, string>> = {
  ana: "Ana",
  joao: "João",
  pedro: "Pedro",
  lia: "Lia",
  marcos: "Marcos",
  bia: "Bia",
  rafa: "Rafa",
  duda: "Duda",
  caio: "Caio",
  nina: "Nina",
  leo: "Léo",
  gabi: "Gabi",
  davi: "Davi",
  sofia: "Sofia",
};

export const TEAM_A = ["ana", "joao", "pedro", "lia", "marcos", "bia"] as const;
export const TEAM_B = ["rafa", "duda", "caio", "nina", "leo", "gabi"] as const;
export const RESERVES = ["davi", "sofia"] as const;
export const G1_ORDER = [...TEAM_A, ...TEAM_B, ...RESERVES];

function player(memberId: string) {
  return { memberId, levelTenths: G1_LEVELS[memberId] ?? 0 };
}

/** The answer of the server for G1: 225 against 220, averages 3,8 and 3,7. */
export function drawAnswer(
  teams: readonly (readonly string[])[] = [TEAM_A, TEAM_B],
  reserves: readonly string[] = RESERVES,
): DrawTeamsAnswer {
  return {
    seed: "1234567890123456789",
    playersPerTeam: teams[0]?.length ?? 0,
    teams: teams.map((members, index) => ({
      number: index + 1,
      members: members.map(player),
      averageTenths: 0,
    })),
    reserves: reserves.map(player),
    differenceTenths: 0,
  };
}

export const G1_ANSWER: DrawTeamsAnswer = {
  ...drawAnswer(),
  teams: drawAnswer().teams.map((team, index) => ({
    ...team,
    averageTenths: index === 0 ? 38 : 37,
  })),
  differenceTenths: 1,
};

export function g1Members(): readonly Member[] {
  return Object.entries(NICKNAMES).map(([memberId, nickname]) => memberOf(memberId, nickname));
}

export function drawSettings(enabled = true): GroupSettings {
  return withLeaf(attendanceSettings(), "draw.enabled", enabled);
}

/** Racha de terça, Ter 3/11, with everyone of G1 confirmed in order of arrival. */
export function g1Round(confirmed: readonly string[] = G1_ORDER, patch: Partial<Round> = {}) {
  return attendanceRound({
    localDate: "2026-11-03",
    capacity: null,
    goingCount: confirmed.length,
    going: confirmed.map((memberId, index) => goingOf(memberId, index + 1)),
    settings: { schemaVersion: 1, layer: null, resolved: drawSettings(), sources: {} },
    ...patch,
  });
}

/** The state right after the G1 draw. */
export function drawnG1(answer: DrawTeamsAnswer = G1_ANSWER): DrawFlowState {
  return drawFlowReducer(initialDrawFlowState, { type: "drawn", answer });
}

export function tap(state: DrawFlowState, ...memberIds: readonly string[]): DrawFlowState {
  return memberIds.reduce(
    (current, memberId) => drawFlowReducer(current, { type: "player-tapped", memberId }),
    state,
  );
}
