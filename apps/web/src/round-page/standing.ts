import type { Standing } from "./round-page.types";

/** Whether the person holds a place on the list (a spot or the waitlist): only then "NÃO VOU MAIS" asks first. */
export function holdsPlace(standing: Standing | null): boolean {
  return standing !== null && standing.status !== "notGoing";
}
