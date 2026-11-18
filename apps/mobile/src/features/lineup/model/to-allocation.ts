import type { LineupAllocation } from "@sacou/match-engine";

import type { LineupDraft } from "./lineup-moves";

/**
 * What `LineupChanged` records, field by field: never a spread of the team, so the `system` and
 * anything else of `TeamState` stay out of the command (pendencias.md, E2.5; E4.8, D7).
 */
export function toAllocation(draft: LineupDraft): LineupAllocation {
  return {
    bench: draft.bench,
    libero: draft.libero,
    lineup: draft.lineup,
    setterZone: draft.setterZone,
  };
}
