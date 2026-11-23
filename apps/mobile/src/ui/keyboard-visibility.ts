/** What the sheets need to know of the soft keyboard; the React Native adapter and the fake fulfil it. */
export interface KeyboardVisibility {
  readonly isVisible: () => boolean;
  /** Tells every change (`true` when it opens); returns the way to stop listening. */
  readonly subscribe: (listener: (visible: boolean) => void) => () => void;
  /** Closes the keyboard and keeps the screen where it is. */
  readonly dismiss: () => void;
}
