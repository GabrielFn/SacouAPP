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
import { CARD_COMPACT_RATIO, cardFontScaleCap, cardMeasures, statTileValueFont } from "./card-tokens.data";
import { sheetFontSizes, sheetRadii, sheetSizes } from "./sheet-tokens.data";

/**
 * `windowWidth` is the width of the window held upright, that is its shorter side (`shortSide`): the
 * court turns the phone on its side and the tokens must not grow 2x for it (ADR 0052).
 */
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

/** Measures of the three sheets of the court (see `sheet-tokens.data.ts`). */
export interface ScaledSheetTokens {
  readonly sizes: NumberMap<typeof sheetSizes>;
  readonly fontSizes: NumberMap<typeof sheetFontSizes>;
  readonly radii: NumberMap<typeof sheetRadii>;
}

/** Measures of the player card: the full one, and the compact one of screen 14 (the full one times the ratio). */
export interface ScaledCardTokens {
  readonly full: NumberMap<typeof cardMeasures>;
  readonly compact: NumberMap<typeof cardMeasures>;
}

export interface ScaledTokens {
  readonly factor: number;
  readonly spacing: NumberMap<typeof spacing>;
  readonly radii: NumberMap<typeof radii>;
  readonly fontSizes: NumberMap<typeof fontSizes>;
  readonly borderWidths: NumberMap<typeof borderWidths>;
  readonly sizes: NumberMap<typeof sizes>;
  readonly court: ScaledCourtTokens;
  readonly sheet: ScaledSheetTokens;
  readonly card: ScaledCardTokens;
  /** The number of a stat tile of screen 14, grown by the system font scale up to the cap. */
  readonly statTileValue: number;
}

function mapValues<T extends Readonly<Record<string, number>>>(
  source: T,
  convert: (value: number) => number,
): NumberMap<T> {
  const entries = Object.entries(source).map(([key, value]) => [key, convert(value)] as const);
  return Object.fromEntries(entries) as NumberMap<T>;
}

/** The side of the window the scale is measured by: the width of the phone upright, in any rotation. */
export function shortSide(windowWidth: number, windowHeight: number): number {
  return Math.min(windowWidth, windowHeight);
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

function createCardTokens(factor: number, fontScale: number): ScaledCardTokens {
  const textGrowth = Math.min(fontScale, cardFontScaleCap);
  const at = (ratio: number) =>
    Object.fromEntries(
      Object.entries(cardMeasures).map(([key, value]) => {
        const growth = key.endsWith("Font") ? textGrowth : 1;
        return [
          key,
          Math.max(accessibilityFloors.hairline, Math.round(value * factor * ratio * growth)),
        ] as const;
      }),
    ) as NumberMap<typeof cardMeasures>;
  return { full: at(1), compact: at(CARD_COMPACT_RATIO) };
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
    card: createCardTokens(factor, fontScale),
    statTileValue: Math.round(statTileValueFont * fontFactor),
    sheet: {
      sizes: mapValues(sheetSizes, (value) => scaleSize(value, factor)),
      fontSizes: mapValues(sheetFontSizes, (value) => Math.round(value * fontFactor)),
      radii: mapValues(sheetRadii, (value) => Math.round(value * factor)),
    },
  };
}
