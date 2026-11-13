import type { MemberId } from "@sacou/match-engine";

export interface NamedMember {
  readonly memberId: MemberId;
  /** The full name, as registered in the group. */
  readonly name: string;
}

/** What the chips and the queue show for each member, by `MemberId`. */
export type DisplayNames = ReadonlyMap<MemberId, string>;

interface ParsedName {
  readonly memberId: MemberId;
  readonly first: string;
  /** The second word of the name, or `null` for a name of one word (or empty). */
  readonly second: string | null;
}

const NAME_SEPARATOR = /\s+/u;
const COMBINING_MARKS = /\p{M}/gu;
const INITIAL_LENGTH = 1;

function parse({ memberId, name }: NamedMember): ParsedName {
  const [first = "", second = null] = name.trim().split(NAME_SEPARATOR);
  return { memberId, first, second };
}

/** "João", "joao" and "JOÃO" are the same first name for telling two players apart. */
function firstNameKey({ first }: ParsedName): string {
  return first.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

function initialsOf(word: string, length: number): string {
  const letters = [...word].slice(0, length);
  const [head = "", ...rest] = letters;
  return `${head.toLocaleUpperCase("pt-BR")}${rest.join("")}`;
}

function withSecond({ first }: ParsedName, second: string, length: number): string {
  const whole = [...second].length <= length;
  return `${first} ${initialsOf(second, length)}${whole ? "" : "."}`;
}

/**
 * Who shares a first name gets the start of the second name ("Ana C."); when that still repeats
 * inside the group, the start grows one letter at a time ("Ana Ca.", "Ana Cl.") until it tells them
 * apart or the second name is whole. A member with a one-word name keeps it as is.
 */
function disambiguate(group: readonly ParsedName[]): readonly (readonly [MemberId, string])[] {
  const longest = Math.max(...group.map(({ second }) => [...(second ?? "")].length));
  const settled = new Map<MemberId, string>();
  for (let length = INITIAL_LENGTH; length <= longest; length += INITIAL_LENGTH) {
    const open = group.filter(({ memberId }) => !settled.has(memberId));
    const labelOf = (parsed: ParsedName) =>
      parsed.second === null ? parsed.first : withSecond(parsed, parsed.second, length);
    const labels = open.map(labelOf);
    open.forEach((parsed, index) => {
      const label = labels[index] ?? "";
      const repeated = labels.indexOf(label) !== labels.lastIndexOf(label);
      if (!repeated || parsed.second === null || length === longest) {
        settled.set(parsed.memberId, label);
      }
    });
  }
  return group.map(({ memberId, first }) => [memberId, settled.get(memberId) ?? first] as const);
}

/**
 * The names on the court (the twelve players and the queue) as they are drawn: the first name; when
 * two members share it, first name and the start of the second ("Ana C."). Pure: the same members
 * always give the same names, whatever the order. The screen reader gets the whole name elsewhere.
 */
export function displayNamesOf(members: readonly NamedMember[]): DisplayNames {
  const groups = new Map<string, ParsedName[]>();
  for (const member of members) {
    const parsed = parse(member);
    const key = firstNameKey(parsed);
    groups.set(key, [...(groups.get(key) ?? []), parsed]);
  }
  const entries = [...groups.values()].flatMap((group) =>
    group.length === 1
      ? group.map(({ memberId, first }) => [memberId, first] as const)
      : disambiguate(group),
  );
  return new Map(entries);
}
