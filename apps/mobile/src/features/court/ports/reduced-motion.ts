/** The "reduce motion" setting of the phone, in the shape `useSyncExternalStore` takes. */
export interface ReducedMotion {
  getSnapshot(): boolean;
  subscribe(listener: () => void): () => void;
}
