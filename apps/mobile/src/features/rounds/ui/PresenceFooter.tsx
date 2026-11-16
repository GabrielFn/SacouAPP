import type { AttendanceResponse } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import type { PresenceActions } from "../model/presence-card";

const { presence } = strings.rounds;

export interface PresenceFooterProps {
  readonly actions: PresenceActions;
  readonly pending: boolean;
  readonly onRespond: (response: AttendanceResponse) => void;
  readonly onAskLeave: () => void;
}

/** "VOU" and "Não vou", or "Não vou mais" with its warning (RodadaJogador.dc.html). */
export function PresenceFooter({ actions, pending, onRespond, onAskLeave }: PresenceFooterProps) {
  switch (actions.kind) {
    case "none":
      return null;
    case "answer":
      return (
        <>
          <Button
            label={presence.goingAction}
            disabled={!actions.canGo || pending}
            onPress={() => {
              onRespond("going");
            }}
          />
          <Button
            label={presence.notGoingAction}
            variant="outline"
            disabled={pending}
            onPress={() => {
              onRespond("notGoing");
            }}
          />
        </>
      );
    case "leave":
      return (
        <>
          <Button
            label={actions.label}
            variant="outline"
            disabled={pending}
            onPress={() => {
              if (actions.needsConfirm) onAskLeave();
              else onRespond("notGoing");
            }}
          />
          {actions.warning === null ? null : (
            <Text variant="muted" style={{ textAlign: "center" }}>
              {actions.warning}
            </Text>
          )}
        </>
      );
  }
}
