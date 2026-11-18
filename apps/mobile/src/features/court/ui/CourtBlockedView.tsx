import { useState } from "react";

import { strings } from "../../../strings/pt-BR";
import type { ScreenAction } from "../../../ui/ActionButtons";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { ErrorScreen } from "../../../ui/ErrorScreen";

/** The courts of another account, or of none (ADR 0067, D8). */
export type OwnerBlock = "other-account" | "unowned";

export interface CourtBlockedViewProps {
  readonly kind: OwnerBlock;
  /** Points of this phone the server never got: taking the court over leaves them out (S4). */
  readonly unsentPoints: number;
  readonly onLeave: () => void;
  /** `null` while the round of the session is not known: no 09a to open. */
  readonly onTakeOver: (() => void) | null;
}

const TEXTS = {
  "other-account": strings.court.otherAccount,
  unowned: strings.court.unowned,
} as const satisfies Record<OwnerBlock, unknown>;

/**
 * The court of another account, or of none (ADR 0067, D8): no gesture, only "Sair da quadra" and
 * "Assumir a quadra", which first says how many points of this phone will be left out.
 */
export function CourtBlockedView({
  kind,
  unsentPoints,
  onLeave,
  onTakeOver,
}: CourtBlockedViewProps) {
  const texts = TEXTS[kind];
  const { discard } = strings.court;
  const [confirming, setConfirming] = useState(false);
  const takeOver: readonly ScreenAction[] =
    onTakeOver === null
      ? []
      : [
          {
            label: texts.takeOver,
            onPress: () => {
              if (unsentPoints > 0) setConfirming(true);
              else onTakeOver();
            },
          },
        ];
  return (
    <>
      <ErrorScreen
        title={texts.title}
        body={texts.body}
        actions={[
          ...takeOver,
          {
            label: texts.leave,
            variant: takeOver.length > 0 ? "outline" : undefined,
            onPress: onLeave,
          },
        ]}
      />
      <ConfirmSheet
        visible={confirming && onTakeOver !== null}
        title={discard.title(unsentPoints)}
        body={discard.body}
        confirmLabel={discard.confirm}
        cancelLabel={discard.cancel}
        onConfirm={() => {
          setConfirming(false);
          onTakeOver?.();
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </>
  );
}
