/** What comes before the name at `index` of a list of `count`: nothing, ", " or " e " before the last. */
function separator(index: number, count: number): string {
  return index === 0 ? "" : index === count - 1 ? " e " : ", ";
}

/**
 * The "Times" card of screens 26 and 06 (R100, ADR 0078): the teams the admin confirmed, a photo of the draw.
 * Names only: never a level. Ordinals in the masculine, as question 41.
 */
export const roundTeamsStrings = {
  title: "Times",
  confirmedAt: (time: string) => `Saíram ${time}`,
  youAreIn: (team: string) => `Você está no ${team}`,
  youAreReserve: (position: number) => `Você está na reserva · ${String(position)}º da fila`,
  youAreLate: "Você confirmou depois dos times. Fale com quem organiza.",
  you: "você",
  left: (name: string) => `${name} (saiu)`,
  /** "Ana, João e você": the members of a team, for the card and for the screen reader. */
  members: (names: readonly string[]) =>
    names.map((name, index) => `${separator(index, names.length)}${name}`).join(""),
  separator,
  team: (team: string, members: string) => `${team}: ${members}`,
  listChangedDraw: "A lista mudou depois dos times. Sorteie de novo.",
  listChangedBuild: "A lista mudou depois dos times. Monte de novo.",
};
