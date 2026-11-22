import { createContext, useContext, type ReactNode } from "react";

/** What the sheets need to know of the soft keyboard; the React Native adapter and the fake fulfil it. */
export interface KeyboardVisibility {
  readonly isVisible: () => boolean;
  /** Tells every change (`true` when it opens); returns the way to stop listening. */
  readonly subscribe: (listener: (visible: boolean) => void) => () => void;
  /** Closes the keyboard and keeps the screen where it is. */
  readonly dismiss: () => void;
}

/** Without a provider (tests, previews) the keyboard is never there. */
const NO_KEYBOARD: KeyboardVisibility = {
  isVisible: () => false,
  subscribe: () => () => undefined,
  dismiss: () => undefined,
};

const KeyboardVisibilityContext = createContext<KeyboardVisibility>(NO_KEYBOARD);

export interface KeyboardVisibilityProviderProps {
  readonly keyboard: KeyboardVisibility;
  readonly children: ReactNode;
}

export function KeyboardVisibilityProvider({
  keyboard,
  children,
}: KeyboardVisibilityProviderProps) {
  return (
    <KeyboardVisibilityContext.Provider value={keyboard}>
      {children}
    </KeyboardVisibilityContext.Provider>
  );
}

export function useKeyboardVisibility(): KeyboardVisibility {
  return useContext(KeyboardVisibilityContext);
}
