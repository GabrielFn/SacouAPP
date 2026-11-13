import { describe, expect, test } from "vitest";

import { displayNamesOf, type NamedMember } from "./display-names";

function members(...names: readonly string[]): readonly NamedMember[] {
  return names.map((name, index) => ({ memberId: `m${String(index)}`, name }));
}

function shown(...names: readonly string[]): readonly string[] {
  const result = displayNamesOf(members(...names));
  return names.map((_, index) => result.get(`m${String(index)}`) ?? "?");
}

describe("display names on the court", () => {
  test("the first name when nobody repeats it", () => {
    expect(shown("Maximiliano Souza", "Ana Carolina", "João Pedro")).toEqual([
      "Maximiliano",
      "Ana",
      "João",
    ]);
  });

  test("a name of one word stays whole", () => {
    expect(shown("Bia", "Guilhermina")).toEqual(["Bia", "Guilhermina"]);
  });

  test("two with the same first name get the initial of the second name", () => {
    expect(shown("Ana Carolina", "Ana Beatriz", "Pedro")).toEqual(["Ana C.", "Ana B.", "Pedro"]);
  });

  test("three Anas whose second names start alike grow the start until they differ", () => {
    expect(shown("Ana Clara", "Ana Carolina", "Ana Beatriz")).toEqual([
      "Ana Cl.",
      "Ana Ca.",
      "Ana B.",
    ]);
  });

  test("a one-word name next to a repeat keeps its own name", () => {
    expect(shown("Maximiliano", "Maximiliano Souza")).toEqual(["Maximiliano", "Maximiliano S."]);
  });

  test("accents and case do not tell first names apart", () => {
    expect(shown("João Pedro", "Joao Lima", "JOÃO silva")).toEqual(["João P.", "Joao L.", "JOÃO S."]);
  });

  test("extra spaces around and between words are ignored", () => {
    expect(shown("  Ana   Carolina ", "Ana Beatriz")).toEqual(["Ana C.", "Ana B."]);
  });

  test("the initial keeps its accent and is upper case", () => {
    expect(shown("Ana émerson", "Ana Zélia")).toEqual(["Ana É.", "Ana Z."]);
  });

  test("the same full name twice cannot be told apart and stays equal", () => {
    expect(shown("Ana Beatriz", "Ana Beatriz")).toEqual(["Ana Beatriz", "Ana Beatriz"]);
  });

  test("an empty name is shown empty and does not break", () => {
    expect(shown("", "   ", "Ana")).toEqual(["", "", "Ana"]);
  });

  test("the result does not depend on the order of the members", () => {
    const forward = displayNamesOf(members("Ana Clara", "Ana Carolina", "Bia"));
    const backward = displayNamesOf([...members("Ana Clara", "Ana Carolina", "Bia")].reverse());
    expect([...forward].sort()).toEqual([...backward].sort());
  });
});
