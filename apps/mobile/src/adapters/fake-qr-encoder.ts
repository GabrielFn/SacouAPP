import type { QrEncoder, QrMatrix } from "../services/qr/qr-encoder";

export interface FakeQrEncoder extends QrEncoder {
  /** Every text encoded, in order. */
  readonly encoded: () => readonly string[];
}

const FAKE_MATRIX: QrMatrix = [
  [true, false],
  [false, true],
];

export function createFakeQrEncoder(): FakeQrEncoder {
  const log = { value: [] as readonly string[] };
  return {
    encode: (text) => {
      log.value = [...log.value, text];
      return FAKE_MATRIX;
    },
    encoded: () => log.value,
  };
}
