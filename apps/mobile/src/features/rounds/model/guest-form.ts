import { checkDisplayText } from "@sacou/match-engine";

import type { AddGuestBody } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { formatLevel, levelOf, SKILL_LEVEL, type LevelTenths } from "../../../ui/skill-level";
import type { GuestSheet } from "./add-player.reducer";

/**
 * The rule of `PersonName` in the C# (ADR 0053, D3): 1 to 20 characters, up to 80 code points (4 per
 * character), nothing invisible, few marks per character. `checkDisplayText` counts the same way.
 */
export const GUEST_NAME_MAX_LENGTH = 20;

const { guest } = roundsStrings;

/** The name as it is sent: trimmed and in NFC, the text the server checks. */
export function normalizeGuestName(text: string): string {
  return text.trim().normalize("NFC");
}

/** `null` when the name passes; an empty one is refused too (the server needs one). */
export function guestNameError(text: string): string | null {
  const name = normalizeGuestName(text);
  if (name === "") return guest.nameRequired;
  return checkDisplayText(name, GUEST_NAME_MAX_LENGTH) === null ? null : guest.nameInvalid;
}

type OpenSheet = Extract<GuestSheet, { readonly kind: "open" }>;

/** The body of `POST /guests`: no level is `null`, the draw then uses 3,0 (ADR 0047). */
export function addGuestBody(name: string, sheet: OpenSheet): AddGuestBody {
  return {
    requestId: sheet.requestId,
    name: normalizeGuestName(name),
    primaryPosition: sheet.position,
    level: sheet.level === null ? null : levelOf(sheet.level),
  };
}

/** "3,0 · definir" without a level, "3,5" with one. */
export function guestLevelText(level: LevelTenths | null): string {
  return level === null
    ? guest.levelUnset(formatLevel(SKILL_LEVEL.defaultTenths))
    : formatLevel(level);
}
