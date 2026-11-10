/** Whether the phone has a network now, and a way to hear when it changes (NetInfo in the app). */
export interface NetworkStatus {
  isOnline(): boolean;
  /** Returns the function that stops listening. */
  subscribe(listener: (online: boolean) => void): () => void;
}
