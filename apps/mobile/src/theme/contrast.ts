export type Rgb = readonly [number, number, number];

export type ParseResult =
  | { readonly ok: true; readonly value: Rgb }
  | { readonly ok: false; readonly error: "invalid-hex" };

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_RADIX = 16;
const BYTE_MAX = 255;
const LINEAR_THRESHOLD = 0.03928;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;
const FLARE = 0.05;

export function parseHex(hex: string): ParseResult {
  const match = HEX_PATTERN.exec(hex);
  if (!match) return { ok: false, error: "invalid-hex" };
  const [, red = "", green = "", blue = ""] = match;
  return {
    ok: true,
    value: [parseInt(red, HEX_RADIX), parseInt(green, HEX_RADIX), parseInt(blue, HEX_RADIX)],
  };
}

function linearize(channel: number): number {
  const unit = channel / BYTE_MAX;
  return unit <= LINEAR_THRESHOLD
    ? unit / LINEAR_DIVISOR
    : Math.pow((unit + GAMMA_OFFSET) / GAMMA_DIVISOR, GAMMA_EXPONENT);
}

export function relativeLuminance([red, green, blue]: Rgb): number {
  return LUMA_RED * linearize(red) + LUMA_GREEN * linearize(green) + LUMA_BLUE * linearize(blue);
}

export type ContrastResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: "invalid-hex" };

export function contrastRatio(firstHex: string, secondHex: string): ContrastResult {
  const first = parseHex(firstHex);
  const second = parseHex(secondHex);
  if (!first.ok || !second.ok) return { ok: false, error: "invalid-hex" };
  const a = relativeLuminance(first.value);
  const b = relativeLuminance(second.value);
  return { ok: true, value: (Math.max(a, b) + FLARE) / (Math.min(a, b) + FLARE) };
}
