import { createContext, useContext } from "react";

/**
 * "This person just said VOU or created a round": the host decides whether the notifications are
 * offered (R98, item 9). Outside the host (tests, signed out) it does nothing.
 */
export const PushPromptContext = createContext<() => void>(() => undefined);

export function useOfferPushPrompt(): () => void {
  return useContext(PushPromptContext);
}
