import {
  accessibilityFloors,
  borderWidths,
  canvasWidth,
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

export interface ScaledTokens {
  readonly factor: number;
  readonly spacing: NumberMap<typeof spacing>;
  readonly radii: NumberMap<typeof radii>;
  readonly fontSizes: NumberMap<typeof fontSizes>;
  readonly borderWidths: NumberMap<typeof borderWidths>;
  readonly sizes: NumberMap<typeof sizes>;
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

export function createScaledTokens({ windowWidth, fontScale }: ScaleInput): ScaledTokens {
  const factor = scaleFactor(windowWidth);
  const scaled = (value: number) => Math.round(value * factor);
  const fontFactor = factor * Math.min(fontScale, fontScaleCap);
  return {
    factor,
    spacing: mapValues(spacing, scaled),
    radii: mapValues(radii, scaled),
    fontSizes: mapValues(fontSizes, (value) => Math.round(value * fontFactor)),
    borderWidths: mapValues(borderWidths, (value) =>
      Math.max(accessibilityFloors.hairline, scaled(value)),
    ),
    // Controls and the logo scale, but never below the touch target floor when interactive.
    sizes: mapValues(sizes, (value) =>
      value >= accessibilityFloors.touchTarget
        ? Math.max(accessibilityFloors.touchTarget, scaled(value))
        : scaled(value),
    ),
  };
}
