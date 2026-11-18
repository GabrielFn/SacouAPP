import type { CourtSessionSummary, Member } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";

const MS_PER_MINUTE = 60_000;

/** The score of the backdrop of 09a to 09c: orange (team A) over blue (team B). */
export interface BackdropScore {
  readonly a: number;
  readonly b: number;
}

/** Who marks the court, by the nickname in the members cache; `null` without one ("Outro celular"). */
export function writerNameOf(
  summary: Pick<CourtSessionSummary, "writer"> | null,
  members: readonly Member[] | undefined,
): string | null {
  if (summary === null) return null;
  const member = members?.find((candidate) => candidate.memberId === summary.writer.memberId);
  const name = member?.nickname?.trim() ?? "";
  return name === "" ? null : name;
}

/** "21h14", in the time zone of the phone; `null` for a date that does not parse. */
export function clockTimeOf(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : strings.court.clockTime(date.getHours(), date.getMinutes());
}

/** What the card of screen 09a says (AssumirQuadra.dc.html). */
export interface TakeoverCardTexts {
  readonly body: string;
  readonly lastPoint: string;
  readonly score: string;
}

function lastPointText(lastEventAt: string | null, nowMs: number): string {
  const { takeover } = strings.court;
  const at = lastEventAt === null ? Number.NaN : new Date(lastEventAt).getTime();
  if (Number.isNaN(at)) return takeover.noPointYet;
  const minutes = Math.floor(Math.max(0, nowMs - at) / MS_PER_MINUTE);
  return minutes < 1 ? takeover.lastPointNow : takeover.lastPointAgo(minutes);
}

export function takeoverCardTexts(
  summary: CourtSessionSummary,
  writerName: string | null,
  nowMs: number,
): TakeoverCardTexts {
  const { takeover } = strings.court;
  const { scoreboard } = summary;
  return {
    body: writerName === null ? takeover.bodyUnnamed : takeover.bodyNamed(writerName),
    lastPoint: lastPointText(summary.lastEventAt, nowMs),
    score:
      scoreboard === null
        ? takeover.noMatchOpen
        : takeover.scoreLine(scoreboard.pointsA, scoreboard.pointsB),
  };
}

export function backdropOf(summary: Pick<CourtSessionSummary, "scoreboard">): BackdropScore | null {
  const { scoreboard } = summary;
  return scoreboard === null ? null : { a: scoreboard.pointsA, b: scoreboard.pointsB };
}

/** The banner of 09b (PlacarAssumido.dc.html), with the name and the time when the summary has them. */
export interface TakenOverTexts {
  readonly title: string;
  readonly body: string;
}

export function takenOverTexts(
  summary: Pick<CourtSessionSummary, "writer"> | null,
  writerName: string | null,
): TakenOverTexts {
  const { takenOver } = strings.court;
  const time = summary === null ? null : clockTimeOf(summary.writer.since);
  return {
    title: writerName === null ? takenOver.title : takenOver.titleNamed(writerName),
    body: time === null ? takenOver.body : takenOver.bodyAt(time),
  };
}

/** The lines of 09c around the list (PontosRecusados.dc.html): who took over, and whom to ask. */
export interface RefusedTexts {
  readonly title: string;
  readonly body: string;
  readonly askFix: string;
}

export function refusedTexts(
  rows: number,
  otherPhoneFirst: boolean,
  summary: Pick<CourtSessionSummary, "writer"> | null,
  writerName: string | null,
): RefusedTexts {
  const { refused } = strings.court;
  const time = summary === null ? null : clockTimeOf(summary.writer.since);
  const named = writerName !== null && time !== null;
  const body = otherPhoneFirst
    ? refused.bodyOtherFirst
    : named
      ? refused.bodyNamed(writerName, time)
      : refused.bodyUnnamed;
  return {
    title: rows === 0 ? refused.undoTitle : refused.title(rows),
    body,
    askFix: writerName === null ? refused.askFix : refused.askFixNamed(writerName),
  };
}
