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

type Entry = readonly [MemberId, string];

const NAME_SEPARATOR = /\s+/u;
const COMBINING_MARKS = /\p{M}/gu;
const ONE = 1;

function parse({ memberId, name }: NamedMember): ParsedName {
  const [first = "", second = null] = name.trim().split(NAME_SEPARATOR);
  return { memberId, first, second };
}

/** "João", "joao" and "JOÃO" are the same first name for telling two players apart. */
function firstNameKey({ first }: ParsedName): string {
  return first.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

function lettersOf(word: string): readonly string[] {
  return Array.from(word);
}

/** The first `length` letters of the second name, the first one upper case ("Ca" of "carolina"). */
function startOf(word: string, length: number): string {
  const [head = "", ...rest] = lettersOf(word).slice(0, length);
  return `${head.toLocaleUpperCase("pt-BR")}${rest.join("")}`;
}

/** "Ana C."; when the start is the whole second name there is nothing left to abbreviate. */
function withSecond({ first }: ParsedName, second: string, length: number): string {
  const whole = lettersOf(second).length <= length;
  return `${first} ${startOf(second, length)}${whole ? "" : "."}`;
}

function labelAt(parsed: ParsedName, length: number): string {
  return parsed.second === null ? parsed.first : withSecond(parsed, parsed.second, length);
}

/**
 * Who shares a first name gets the start of the second name ("Ana C."). Whoever still repeats
 * another's label gets one more letter at a time ("Ana Ca.", "Ana Cl.") until told apart or the
 * second name is whole; who is already unique keeps the short label. A one-word name stays as is.
 */
function disambiguate(group: readonly ParsedName[]): readonly Entry[] {
  const longest = Math.max(...group.map(({ second }) => lettersOf(second ?? "").length));
  const resolve = (open: readonly ParsedName[], length: number): readonly Entry[] => {
    const labelled = open.map((parsed) => ({ parsed, label: labelAt(parsed, length) }));
    const isFinal = ({ parsed, label }: (typeof labelled)[number]) =>
      parsed.second === null ||
      length >= longest ||
      labelled.filter((other) => other.label === label).length === ONE;
    const done = labelled
      .filter(isFinal)
      .map(({ parsed, label }) => [parsed.memberId, label] as const);
    const rest = labelled.filter((item) => !isFinal(item)).map(({ parsed }) => parsed);
    return rest.length === 0 ? done : [...done, ...resolve(rest, length + ONE)];
  };
  return resolve(group, ONE);
}

/**
 * The names on the court (the twelve players and the queue) as they are drawn: the first name; when
 * two members share it, first name and the start of the second ("Ana C."). Pure: the same members
 * always give the same names, whatever the order. The screen reader gets the whole name elsewhere.
 */
export function displayNamesOf(members: readonly NamedMember[]): DisplayNames {
  const parsed = members.map(parse);
  const keys = [...new Set(parsed.map(firstNameKey))];
  const entries = keys.flatMap((key) => {
    const group = parsed.filter((member) => firstNameKey(member) === key);
    return group.length === ONE
      ? group.map(({ memberId, first }) => [memberId, first] as const)
      : disambiguate(group);
  });
  return new Map(entries);
}
