// Rallies that reach the states of the design screens, one letter per point: the team that scores.

/** Set 1 ends 25-22 for Laranja (Azul scores 22 on the serve of Laranja, then Laranja 25). */
export const SET_ONE_RALLIES = `${"b".repeat(22)}${"a".repeat(25)}`;

/** Set 2 of screen 09 reaches 18-15 (82 events with set 1, corrections.test.ts). */
export const SCREEN_09_SET_TWO_RALLIES = `${"a".repeat(12)}${"b".repeat(11)}aabbaabbaa`;

/**
 * Screen 10: Laranja in zone 1 and Azul in zone 6 start the set, and after six side-outs each they
 * are there again at 24-21. Each round is a side-out for Azul, the points Azul scores serving, a
 * side-out for Laranja and the points Laranja scores serving (6 + 18 and 6 + 15 points).
 */
export const SCREEN_10_ROUNDS = [
  { azul: 2, laranja: 3 },
  { azul: 2, laranja: 3 },
  { azul: 3, laranja: 3 },
  { azul: 3, laranja: 3 },
  { azul: 3, laranja: 3 },
  { azul: 2, laranja: 3 },
] as const;

export const AZUL_ZONE_ON_SCREEN_10 = 6;
