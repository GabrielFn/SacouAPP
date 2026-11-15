import { roundsStrings } from "../../../strings/rounds.pt-BR";
import type { RosterEntry } from "./roster";

const { confirmed: texts, detail } = roundsStrings;

/** Four others and "você", the five avatars of RodadaJogador.dc.html. */
const NAMES_SHOWN = 5;

/** One piece of the line; `strong` is "você", in bold. */
export interface SummaryPart {
  readonly text: string;
  readonly strong: boolean;
}

export interface ConfirmedSummary {
  /** The initials of the names shown, for the avatars. */
  readonly initials: readonly string[];
  readonly parts: readonly SummaryPart[];
}

interface ShownName {
  readonly name: string;
  readonly isMe: boolean;
}

function byPosition(roster: readonly RosterEntry[]): readonly RosterEntry[] {
  return [...roster].sort((first, second) => first.position - second.position);
}

/** The first names by position, with "você" always among them when you are on the list. */
function shownNames(roster: readonly RosterEntry[], meId: string): readonly ShownName[] {
  const ordered = byPosition(roster);
  const mine = ordered.some((entry) => entry.memberId === meId);
  const others = ordered
    .filter((entry) => entry.memberId !== meId)
    .slice(0, mine ? NAMES_SHOWN - 1 : NAMES_SHOWN)
    .map((entry) => ({ name: entry.name ?? detail.noName, isMe: false }));
  return mine ? [...others, { name: texts.you, isMe: true }] : others;
}

function joined(names: readonly ShownName[], rest: number): readonly SummaryPart[] {
  const parts = names.flatMap((shown, index): SummaryPart[] => {
    const isLast = index === names.length - 1;
    const separator = isLast ? "" : rest === 0 && index === names.length - 2 ? " e " : ", ";
    const name: SummaryPart = { text: shown.name, strong: shown.isMe };
    return separator === "" ? [name] : [name, { text: separator, strong: false }];
  });
  return rest > 0 ? [...parts, { text: texts.andMore(rest), strong: false }] : parts;
}

/** "Ana, Pedro, Lia, Marcos, **você** e mais 7"; "Ana, Pedro e Lia"; "Ninguém confirmou ainda". */
export function confirmedSummary(roster: readonly RosterEntry[], meId: string): ConfirmedSummary {
  if (roster.length === 0) return { initials: [], parts: [{ text: texts.nobody, strong: false }] };
  const names = shownNames(roster, meId);
  return {
    initials: names.map((shown) => initialOf(shown.name)),
    parts: joined(names, roster.length - names.length),
  };
}

/** The text of the parts, for the screen reader and the tests. */
export function summaryText(summary: ConfirmedSummary): string {
  return summary.parts.map((part) => part.text).join("");
}

/** The first letter of a name, in capitals; "?" for a name without letters. */
export function initialOf(name: string): string {
  const first = [...name.trim()][0];
  return first === undefined ? texts.noInitial : first.toLocaleUpperCase("pt-BR");
}
