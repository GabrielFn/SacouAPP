/** Keeps the screen on. The tag pairs an `activate` with its `deactivate`. */
export interface ScreenAwake {
  activate(tag: string): void;
  deactivate(tag: string): void;
}
