/** Runs a task once after a wait (the backoff of the upload); the returned function cancels it. */
export interface Scheduler {
  after(delayMs: number, task: () => void): () => void;
}
