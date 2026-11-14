// Sample names, in the order of the lineups of sample-match.data.ts (setter first). Development
// only: the app has no names in its log, and the real ones come from the group (E4.2, E4.7).
export const SAMPLE_ORANGE_NAMES: readonly string[] = [
  "Pedro",
  "Ana",
  "Lia",
  "Marcos",
  "Bia",
  "João",
];
export const SAMPLE_LIBERO_NAME = "Tati";
export const SAMPLE_BLUE_NAMES: readonly string[] = ["Gabi", "Rafa", "Caio", "Nina", "Duda", "Léo"];
export const SAMPLE_QUEUE_NAMES: readonly string[] = ["Davi", "Sofia"];

// The long lineup of the "long names" sample (E4.17): names that fill a chip, two sharing a first
// name on the court ("Ana Carolina", "Ana Clara", "Ana Beatriz") and one in the queue sharing it with
// a player ("Maximiliano" and "Maximiliano Souza"), so the short names have to tell them apart.
export const SAMPLE_LONG_ORANGE_NAMES: readonly string[] = [
  "Maximiliano",
  "Ana Carolina",
  "Guilhermina",
  "João Pedro",
  "Bernardete",
  "Valentina",
];
export const SAMPLE_LONG_LIBERO_NAME = "Maria Eduarda";
export const SAMPLE_LONG_BLUE_NAMES: readonly string[] = [
  "Ana Clara",
  "Wellington",
  "Christopher",
  "Ana Beatriz",
  "Jaqueline",
  "Bartolomeu",
];
export const SAMPLE_LONG_QUEUE_NAMES: readonly string[] = ["Maximiliano Souza", "Ana Paula Lima"];
