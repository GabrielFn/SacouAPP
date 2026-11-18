/** What the court route adds to the match: the sides the teams are drawn on and the battery alert. */
export interface CourtBatteryAlert {
  readonly level: number;
  readonly onDismiss: () => void;
}

export interface CourtExtras {
  /** "Inverter lados": drawing only, the teams and their points do not change. */
  readonly inverted?: boolean;
  /** `null` or missing: no alert. */
  readonly battery?: CourtBatteryAlert | null;
  /** What DESFAZER just took back, shown for a few seconds where the hint is; `null` or missing: the hint. */
  readonly notice?: string | null;
}
