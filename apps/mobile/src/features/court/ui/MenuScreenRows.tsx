import type { ReactNode } from "react";

import { lineupStrings } from "../../../strings/lineup.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { isMenuScreenReady } from "../model/menu-selectors";
import { LineupIcon, SwapPlayersIcon, TimelineIcon } from "./MenuIcons";
import { MenuRow } from "./MenuRow";

export interface ScreenRowsProps {
  readonly canSubstitute: boolean;
  readonly onLineup: (() => void) | null;
  readonly onSubstitution: () => void;
  readonly onCorrections: () => void;
}

/**
 * The rows that open another screen of the court, each only once its screen exists. A flat list
 * (not a fragment), so the group sees each row and draws the dividers between them.
 */
export function screenRows({
  canSubstitute,
  onLineup,
  onSubstitution,
  onCorrections,
}: ScreenRowsProps): ReactNode[] {
  const { menu } = strings.court;
  const { courtPlayers } = strings;
  return [
    isMenuScreenReady("lineup") && onLineup !== null ? (
      <MenuRow
        key="lineup"
        label={lineupStrings.menuItem}
        renderIcon={(color) => <LineupIcon color={color} />}
        chevron
        onPress={onLineup}
      />
    ) : null,
    isMenuScreenReady("substitution") ? (
      <MenuRow
        key="substitution"
        label={courtPlayers.substitution.menuItem}
        renderIcon={(color) => <SwapPlayersIcon color={color} />}
        {...(canSubstitute ? {} : { hint: courtPlayers.substitution.noBench })}
        chevron={canSubstitute}
        disabled={!canSubstitute}
        onPress={onSubstitution}
      />
    ) : null,
    isMenuScreenReady("corrections") ? (
      <MenuRow
        key="corrections"
        label={menu.corrections}
        renderIcon={(color) => <TimelineIcon color={color} />}
        hint={menu.correctionsHint}
        chevron
        onPress={onCorrections}
      />
    ) : null,
  ];
}
