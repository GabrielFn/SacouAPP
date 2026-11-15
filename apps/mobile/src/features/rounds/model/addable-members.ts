import type { Member, MemberType, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import type { MemberAttendanceResult } from "../queries/round-mutations";
import { initialOf } from "./confirmed-summary";

const { add, detail } = roundsStrings;
const COMBINING_MARKS = /\p{M}/gu;
const LOCALE = "pt-BR";

/** One row of "Ainda não confirmaram" on screen 21. */
export interface AddableRow {
  readonly memberId: string;
  /** "Você", the nickname or "Sem apelido". */
  readonly name: string;
  readonly initial: string;
  /** "Mensalista", "Avulso" or "Sem conta". */
  readonly detail: string;
}

const TYPE_ORDER: Readonly<Record<MemberType, number>> = { regular: 0, dropIn: 1 };

/** Lower case and without accents, so "joao" finds "João". */
export function normalizedSearch(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLocaleLowerCase(LOCALE).trim();
}

function nameOf(member: Member): string {
  if (member.isMe) return add.you;
  return member.nickname ?? detail.noName;
}

function detailOf(member: Member): string {
  if (!member.hasAccount) return add.noAccount;
  return member.memberType === "regular" ? add.regular : add.dropIn;
}

function placedIds(round: Round): ReadonlySet<string> {
  return new Set([...round.going, ...round.waitlist].map((entry) => entry.memberId));
}

function matches(member: Member, query: string): boolean {
  return query === "" || normalizedSearch(member.nickname ?? "").includes(query);
}

function compareMembers(first: Member, second: Member): number {
  const byType = TYPE_ORDER[first.memberType] - TYPE_ORDER[second.memberType];
  return byType !== 0 ? byType : nameOf(first).localeCompare(nameOf(second), LOCALE);
}

/**
 * Who can still be added: the members with no spot nor place on the waitlist (`notGoing` and no answer
 * stay), mensalistas first, then avulsos, then by name.
 */
export function addableMembers(
  members: readonly Member[],
  round: Round,
  search: string,
): readonly AddableRow[] {
  const placed = placedIds(round);
  const query = normalizedSearch(search);
  return members
    .filter((member) => !placed.has(member.memberId) && matches(member, query))
    .sort(compareMembers)
    .map((member) => {
      const name = nameOf(member);
      return { memberId: member.memberId, name, initial: initialOf(name), detail: detailOf(member) };
    });
}

/** "Davi entrou na lista." or "Davi entrou na espera (2º).": the place the server gave. */
export function addedText(result: MemberAttendanceResult, members: readonly Member[]): string {
  const member = members.find((candidate) => candidate.memberId === result.memberId);
  const name = member?.isMe === true ? add.you : (member?.nickname ?? detail.noName);
  const { status, position } = result.answer;
  return status === "waitlisted" && position !== null
    ? add.waitlisted(name, position)
    : add.added(name);
}
