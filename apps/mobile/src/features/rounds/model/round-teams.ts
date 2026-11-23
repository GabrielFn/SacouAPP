import type { GroupRole, Member, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { drawNamesOf } from "../../draw/model/draw-names";
import { canDraw } from "../../draw/model/can-draw";
import { teamIdentity, type TeamIdentity } from "../../draw/model/team-identity";
import { formatTime } from "../../groups/model/schedule-text";
import { localWallTime } from "./round-clock";
import { isCanceled } from "./round-detail";

const { teams: texts } = roundsStrings;
const PAD_WIDTH = 2;

/** Where the reader is in the published teams (ADR 0078, question 180). */
export type MyPlacement =
  | { readonly kind: "team"; readonly team: TeamIdentity }
  | { readonly kind: "reserve"; readonly position: number }
  /** Confirmed, but after the teams: in no team and not in the queue. */
  | { readonly kind: "late" }
  /** Not confirmed: no line. */
  | { readonly kind: "none" };

/** A name of a team: the reader is "você" (in bold), whoever left the round carries "(saiu)". */
export interface TeamMemberName {
  readonly text: string;
  readonly me: boolean;
}

export interface RoundTeamView {
  readonly identity: TeamIdentity;
  readonly names: readonly TeamMemberName[];
}

export interface RoundTeamsView {
  readonly teams: readonly RoundTeamView[];
  /** The queue of reserves, in order, already named. */
  readonly reserves: readonly string[];
  readonly me: MyPlacement;
  /** "19h42", in the zone of the round; empty when the instant does not parse. */
  readonly confirmedAtText: string;
  /** Someone of the teams left the round, or someone confirmed is in no team nor queue (question 180). */
  readonly listChanged: boolean;
}

type PublishedTeams = NonNullable<Round["teams"]>;

function confirmedAtText(round: Round, teams: PublishedTeams): string {
  const wall = localWallTime(round, teams.confirmedAt);
  if (wall === null) return "";
  const hours = String(wall.getUTCHours()).padStart(PAD_WIDTH, "0");
  const minutes = String(wall.getUTCMinutes()).padStart(PAD_WIDTH, "0");
  return formatTime(`${hours}:${minutes}`);
}

function placementOf(teams: PublishedTeams, meId: string, going: ReadonlySet<string>): MyPlacement {
  if (!going.has(meId)) return { kind: "none" };
  const team = teams.teams.findIndex((entry) => entry.memberIds.includes(meId));
  if (team >= 0) return { kind: "team", team: teamIdentity(team) };
  const reserve = teams.reserves.indexOf(meId);
  return reserve >= 0 ? { kind: "reserve", position: reserve + 1 } : { kind: "late" };
}

function hasChanged(teams: PublishedTeams, going: ReadonlySet<string>): boolean {
  const published = [...teams.teams.flatMap((team) => team.memberIds), ...teams.reserves];
  const inTeams = new Set(published);
  return published.some((id) => !going.has(id)) || [...going].some((id) => !inTeams.has(id));
}

/**
 * The "Times" card of screens 26 and 06, derived from the round and the members (frontend.md, rule 1): `null` with
 * no teams and in a cancelled round. The names are the short names of the court ("Sem apelido" without one).
 */
export function roundTeamsView(round: Round, members: readonly Member[]): RoundTeamsView | null {
  const teams = round.teams;
  if (teams === null || isCanceled(round)) return null;
  const meId = round.me.memberId;
  const going = new Set(round.going.map((entry) => entry.memberId));
  const nameOf = drawNamesOf(members);
  const named = (memberId: string): TeamMemberName => {
    if (memberId === meId) return { text: texts.you, me: true };
    const name = nameOf(memberId);
    return { text: going.has(memberId) ? name : texts.left(name), me: false };
  };
  const ordered = [...teams.teams].sort((left, right) => left.number - right.number);
  return {
    teams: ordered.map((team, index) => ({
      identity: teamIdentity(index),
      names: team.memberIds.map(named),
    })),
    reserves: teams.reserves.map((memberId) => named(memberId).text),
    me: placementOf({ ...teams, teams: ordered }, meId, going),
    confirmedAtText: confirmedAtText(round, teams),
    listChanged: hasChanged(teams, going),
  };
}

/** "Você está no Laranja", "Você está na reserva · 1º da fila", the late line, or `null` for no line. */
export function placementText(me: MyPlacement): string | null {
  switch (me.kind) {
    case "team":
      return texts.youAreIn(me.team.name);
    case "reserve":
      return texts.youAreReserve(me.position);
    case "late":
      return texts.youAreLate;
    case "none":
      return null;
  }
}

export interface AdminTeamsInput {
  readonly role: GroupRole;
  readonly ended: boolean;
  /** With the draw off the 07 builds the teams by hand: "Monte de novo" (question 72). */
  readonly drawOff: boolean;
}

/**
 * "A lista mudou depois dos times..." of screen 06 (question 180): only to who draws, while the round is on, and only
 * when the list moved since the teams.
 */
export function listChangedLine(
  view: RoundTeamsView | null,
  input: AdminTeamsInput,
): string | null {
  if (view === null || !view.listChanged || input.ended || !canDraw(input.role)) return null;
  return input.drawOff ? texts.listChangedBuild : texts.listChangedDraw;
}

export interface AdminTeams {
  readonly view: RoundTeamsView;
  readonly listChangedText: string | null;
}

/** The card of screen 06: the teams and, for who draws, the line of question 180; `null` with no teams. */
export function adminTeams(
  round: Round,
  members: readonly Member[],
  input: AdminTeamsInput,
): AdminTeams | null {
  const view = roundTeamsView(round, members);
  return view === null ? null : { view, listChangedText: listChangedLine(view, input) };
}

/** "Laranja: Ana, João e você": one text per team for the screen reader. */
export function teamLabel(team: RoundTeamView): string {
  return texts.team(team.identity.name, texts.members(team.names.map((name) => name.text)));
}
