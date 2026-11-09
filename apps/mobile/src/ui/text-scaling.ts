/**
 * The sizes of the tokens already follow the font scale of the system, with a cap (theme/scale.ts);
 * the native text must not scale them a second time, without that cap.
 */
export const TEXT_SCALING_PROPS = { allowFontScaling: false } as const;
