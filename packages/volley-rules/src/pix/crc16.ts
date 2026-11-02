import {
  CRC_BITS_PER_BYTE,
  CRC_BYTE_SHIFT,
  CRC_HEX_LENGTH,
  CRC_HEX_RADIX,
  CRC_HIGH_BIT,
  CRC_INITIAL,
  CRC_MASK,
  CRC_POLYNOMIAL,
} from "./constants.data.js";

const BIT_STEPS: readonly number[] = Array.from({ length: CRC_BITS_PER_BYTE }, () => 0);

/** CRC-16 with polynomial 0x1021 and initial value 0xFFFF, as 4 uppercase hex digits. */
export function crc16CcittFalse(ascii: string): string {
  const crc = Array.from(ascii).reduce(
    (current, char) => absorbByte(current, char.charCodeAt(0)),
    CRC_INITIAL,
  );
  return crc.toString(CRC_HEX_RADIX).toUpperCase().padStart(CRC_HEX_LENGTH, "0");
}

function absorbByte(crc: number, byte: number): number {
  return BIT_STEPS.reduce((current) => shiftOneBit(current), crc ^ (byte << CRC_BYTE_SHIFT));
}

function shiftOneBit(crc: number): number {
  const shifted = (crc << 1) & CRC_MASK;
  return (crc & CRC_HIGH_BIT) === 0 ? shifted : shifted ^ CRC_POLYNOMIAL;
}
