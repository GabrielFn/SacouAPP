import type { QrMatrix } from "../services/qr/qr-encoder";

/** The dark modules as one SVG path, a unit square each, shifted by the quiet zone. */
export function qrPath(matrix: QrMatrix, margin: number): string {
  return matrix
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${String(x + margin)} ${String(y + margin)}h1v1h-1z` : "")),
    )
    .join("");
}
