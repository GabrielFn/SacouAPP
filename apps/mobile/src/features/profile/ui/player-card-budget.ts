import {
  CARD_ASPECT_RATIO,
  CARD_LABEL_LINE_HEIGHT,
  CARD_TIGHT_LINE_HEIGHT,
} from "../../../theme/card-tokens.data";
import type { ScaledCardMeasures } from "../../../theme/scale";
import { CARD_STAT_KEYS } from "../model/player-card";
import { cardLayout } from "./player-card.layout.data";

const PERCENT = 100;
const FRAME_SIDES = 2;
const WHOLE = 1;

/** The three columns of the grid (`.kst`: `repeat(3, ...)`). */
export const STAT_COLUMNS = 3;

/** The line heights of the card text, set on the Text itself: the budget below counts on them. */
export interface CardTextLines {
  readonly statValue: number;
  readonly statLabel: number;
  readonly brand: number;
}

export function cardTextLines(m: ScaledCardMeasures): CardTextLines {
  return {
    statValue: Math.round(m.statValueFont * CARD_TIGHT_LINE_HEIGHT),
    statLabel: Math.round(m.statLabelFont * CARD_LABEL_LINE_HEIGHT),
    brand: Math.round(m.brandFont * CARD_TIGHT_LINE_HEIGHT),
  };
}

/** The heights under the name band of a card `cardWidth` wide: what the grid and the footer take. */
export interface CardLowerBudget {
  readonly available: number;
  readonly grid: number;
  readonly footer: number;
}

function share(percent: string): number {
  return parseFloat(percent) / PERCENT;
}

export function cardLowerBudget(cardWidth: number, m: ScaledCardMeasures): CardLowerBudget {
  const frame = m.frameBorder * FRAME_SIDES;
  const innerWidth = cardWidth - frame;
  const innerHeight = cardWidth / CARD_ASPECT_RATIO - frame;
  const lines = cardTextLines(m);
  const rows = Math.ceil(CARD_STAT_KEYS.length / STAT_COLUMNS);
  return {
    available: innerHeight * (WHOLE - share(cardLayout.lower.top)),
    grid: rows * (lines.statValue + lines.statLabel) + (rows - WHOLE) * m.statRowGap,
    footer: Math.max(m.seasonHeight, lines.brand) + innerWidth * share(cardLayout.footer.bottom),
  };
}
