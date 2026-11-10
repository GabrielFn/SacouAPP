/**
 * The wall-clock time in milliseconds, for texts such as "atualizado há 2 h". It is a function apart so
 * a screen reads it without calling the global inside the render (the injected `Clock` is monotonic).
 */
export function wallClockNow(): number {
  return Date.now();
}
