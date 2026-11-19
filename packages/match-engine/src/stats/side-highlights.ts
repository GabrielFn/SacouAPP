import type { SidesStats, SideHighlights } from "./types.js";

/**
 * "Time que mais venceu" and "Maior sequência" of screen 12, from `getSideStats`: the side ahead,
 * or `null` on a tie, so the screen hides the card (E3.9, 3.4).
 */
export function getSideHighlights({ a, b }: SidesStats): SideHighlights {
  return {
    mostWins:
      a.wins === b.wins
        ? null
        : { side: a.wins > b.wins ? "a" : "b", wins: Math.max(a.wins, b.wins) },
    longestStreak:
      a.longestWinStreak === b.longestWinStreak
        ? null
        : {
            side: a.longestWinStreak > b.longestWinStreak ? "a" : "b",
            longestWinStreak: Math.max(a.longestWinStreak, b.longestWinStreak),
          },
  };
}
