import type { CourtLayout } from "../model/court-layout";
import type { CourtScreenModel } from "../model/court-screen.types";
import { streakText } from "../model/screen-texts";
import { BatteryBanner } from "./BatteryBanner";
import type { CourtBatteryAlert } from "./court-extras";
import { QueueStrip } from "./QueueStrip";

export interface BottomStripProps {
  readonly model: CourtScreenModel;
  readonly layout: CourtLayout;
  readonly battery: CourtBatteryAlert | null;
}

/** The queue, which the low battery alert replaces until "Entendi" or the charger. */
export function BottomStrip({ model, layout, battery }: BottomStripProps) {
  return battery === null ? (
    <QueueStrip queue={model.queue} streak={streakText(model)} layout={layout} />
  ) : (
    <BatteryBanner layout={layout} level={battery.level} onDismiss={battery.onDismiss} />
  );
}
