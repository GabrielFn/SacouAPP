/** The five whole levels of screen 27: the screen offers no half points (`perfil-e-nota.md`). */
export const SELF_LEVELS = [1, 2, 3, 4, 5] as const;

export type SelfLevel = (typeof SELF_LEVELS)[number];
