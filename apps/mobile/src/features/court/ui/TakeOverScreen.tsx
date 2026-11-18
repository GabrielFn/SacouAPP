import { wallClockNow } from "../../../services/api/wall-clock";
import { useTakeOver } from "../hooks/use-take-over";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { takeOverView } from "../takeover/takeover-view";
import { TakeOverDialog } from "./TakeOverDialog";

export interface TakeOverScreenProps {
  readonly origin: CourtSessionOrigin;
}

/** Screen 09a: the hook holds the flow, the view is derived, the dialog only draws it. */
export function TakeOverScreen({ origin }: TakeOverScreenProps) {
  const model = useTakeOver(origin);
  const view = takeOverView(model, wallClockNow());
  return (
    <TakeOverDialog
      card={view.card}
      backdrop={view.backdrop}
      notice={view.notice}
      action={view.action}
      onConfirm={model.confirm}
      onRetry={model.retry}
      onBack={model.close}
    />
  );
}
