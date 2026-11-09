import {
  accessibilityFloors,
  borderWidths,
  canvasWidth,
  courtBorderWidths,
  courtFontSizes,
  courtSizes,
  courtSpacing,
  fontScaleCap,
  fontSizes,
  radii,
  scaleLimits,
  sizes,
  spacing,
} from "./tokens.data";

export interface ScaleInput {
  readonly windowWidth: number;
  readonly fontScale: number;
}

type NumberMap<T> = { readonly [K in keyof T]: number };

/** Measures of the court screens, scaled like the rest. */
export interface ScaledCourtTokens {
  readonly sizes: NumberMap<typeof courtSizes>;
  readonly fontSizes: NumberMap<typeof courtFontSizes>;
  readonly borderWidths: NumberMap<typeof courtBorderWidths>;
  readonly spacing: NumberMap<typeof courtSpacing>;
}

export interface ScaledTokens {
  readonly factor: number;
  readonly spacing: NumberMap<typeof spacing>;
  readonly radii: NumberMap<typeof radii>;
  readonly fontSizes: NumberMap<typeof fontSizes>;
  readonly borderWidths: NumberMap<typeof borderWidths>;
  readonly sizes: NumberMap<typeof sizes>;
  readonly court: ScaledCourtTokens;
}

function mapValues<T extends Readonly<Record<string, number>>>(
  source: T,
  convert: (value: number) => number,
): NumberMap<T> {
  const entries = Object.entries(source).map(([key, value]) => [key, convert(value)] as const);
  return Object.fromEntries(entries) as NumberMap<T>;
}

export function scaleFactor(windowWidth: number): number {
  const raw = windowWidth / canvasWidth;
  return Math.min(scaleLimits.max, Math.max(scaleLimits.min, raw));
}

/** Controls and the logo scale, but never below the touch target floor when interactive. */
function scaleSize(value: number, factor: number): number {
  const scaled = Math.round(value * factor);
  return value >= accessibilityFloors.touchTarget
    ? Math.max(accessibilityFloors.touchTarget, scaled)
    : scaled;
}

function scaleBorder(value: number, factor: number): number {
  return Math.max(accessibilityFloors.hairline, Math.round(value * factor));
}

function createCourtTokens(factor: number, fontFactor: number): ScaledCourtTokens {
  return {
    sizes: mapValues(courtSizes, (value) => scaleSize(value, factor)),
    fontSizes: mapValues(courtFontSizes, (value) => Math.round(value * fontFactor)),
    borderWidths: mapValues(courtBorderWidths, (value) => scaleBorder(value, factor)),
    spacing: mapValues(courtSpacing, (value) => Math.round(value * factor)),
  };
}

export function createScaledTokens({ windowWidth, fontScale }: ScaleInput): ScaledTokens {
  const factor = scaleFactor(windowWidth);
  const scaled = (value: number) => Math.round(value * factor);
  const fontFactor = factor * Math.min(fontScale, fontScaleCap);
  return {
    factor,
    spacing: mapValues(spacing, scaled),
    radii: mapValues(radii, scaled),
    fontSizes: mapValues(fontSizes, (value) => Math.round(value * fontFactor)),
    borderWidths: mapValues(borderWidths, (value) => scaleBorder(value, factor)),
    sizes: mapValues(sizes, (value) => scaleSize(value, factor)),
    court: createCourtTokens(factor, fontFactor),
  };
}
