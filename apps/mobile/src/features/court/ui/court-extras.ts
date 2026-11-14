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
}
