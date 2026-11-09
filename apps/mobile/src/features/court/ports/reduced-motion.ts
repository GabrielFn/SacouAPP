/** The "reduce motion" setting of the phone, in the shape `useSyncExternalStore` takes. */
export interface ReducedMotion {
  readonly getSnapshot: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}
