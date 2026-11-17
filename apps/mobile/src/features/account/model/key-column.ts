import { fontScaleCap } from "../../../theme/tokens.data";

/** The key column of "Seus dados": 72 of the 358 of the card in the canvas (Conta.dc.html `.k`). */
const KEY_BASE_PERCENT = 20;

/** The column grows with the text, so a key word never breaks in the middle at a large font. */
export function keyColumnBasis(fontScale: number): `${number}%` {
  return `${String(KEY_BASE_PERCENT * Math.min(Math.max(fontScale, 1), fontScaleCap))}%`;
}
