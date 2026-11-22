import type { ReactNode } from "react";

import { strings } from "../../../strings/pt-BR";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { PushPromptContext } from "../hooks/push-prompt-context";
import { usePushPrompt } from "../hooks/use-push-prompt";

const { prompt } = strings.notifications;

export interface PushPromptHostProps {
  readonly children: ReactNode;
}

/**
 * The signed-in app under the offer of the notifications: the screens call it after a first "VOU" or
 * a first round, and the sentence comes before the system question (R98, item 9, question 1).
 */
export function PushPromptHost({ children }: PushPromptHostProps) {
  const { offer, visible, accept, decline } = usePushPrompt();
  return (
    <PushPromptContext.Provider value={offer}>
      {children}
      <BottomSheet visible={visible} title={prompt.title} onClose={decline}>
        <Text variant="muted">{prompt.body}</Text>
        <Button label={prompt.enable} onPress={accept} />
        <Button label={prompt.later} variant="outline" onPress={decline} />
      </BottomSheet>
    </PushPromptContext.Provider>
  );
}
