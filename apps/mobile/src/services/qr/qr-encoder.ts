/** One QR code as rows of modules: `true` is a dark module. The quiet zone is not part of it. */
export type QrMatrix = readonly (readonly boolean[])[];

/** Turns a text into a QR matrix, error correction M (ADR 0049, D7). The component only draws it. */
export interface QrEncoder {
  encode(text: string): QrMatrix;
}
