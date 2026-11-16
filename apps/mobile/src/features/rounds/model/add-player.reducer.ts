import type { AttendanceAnswer, PrimaryPosition } from "../../../services/api/sacou-api";
import { SKILL_LEVEL, type LevelTenths } from "../../../ui/skill-level";

/** The five positions of the sheet 21a; "Qualquer uma" is not offered there (AdicionarConvidado.dc.html). */
export type GuestPosition = Exclude<PrimaryPosition, "any">;

export const GUEST_POSITIONS: readonly GuestPosition[] = [
  "setter",
  "outsideHitter",
  "opposite",
  "middleBlocker",
  "libero",
];

/**
 * The sheet 21a, and its level step in place of it (two `Modal`s do not stack on Android). The
 * `requestId` is born when it opens and dies only when it closes: trying again after an error or a
 * dropped network reuses it, so the server answers the same guest (ADR 0053, D5).
 */
export type GuestSheet =
  | { readonly kind: "closed" }
  | {
      readonly kind: "open";
      readonly step: "form" | "level";
      readonly requestId: string;
      readonly position: GuestPosition | null;
      /** `null` is "sem nota": the draw uses 3,0 (ADR 0047). */
      readonly level: LevelTenths | null;
      /** The number of the level step while it is open; thrown away by "Agora não". */
      readonly levelDraft: LevelTenths;
    };

/** The guest that just went in, by IDs only: its name comes from the member list. */
export interface AddedGuest {
  readonly memberId: string;
  readonly answer: AttendanceAnswer;
}

/** Screen 21's own state besides the search: the guest's name and the sheet (frontend.md, rule 4). */
export interface AddPlayerState {
  readonly guestName: string;
  readonly guestSheet: GuestSheet;
  readonly lastGuest: AddedGuest | null;
}

type SheetAction =
  | { readonly type: "guest-name-changed"; readonly name: string }
  /** The ID comes from the `IdGenerator` port, outside: the reducer stays pure. */
  | { readonly type: "guest-opened"; readonly requestId: string }
  | { readonly type: "guest-closed" }
  | { readonly type: "guest-added"; readonly guest: AddedGuest }
  /** A member was added after the guest: the note of the guest goes away. */
  | { readonly type: "member-add-started" };

type GuestAction =
  | { readonly type: "guest-position-toggled"; readonly position: GuestPosition }
  | { readonly type: "guest-level-opened" }
  | { readonly type: "guest-level-drafted"; readonly tenths: LevelTenths }
  | { readonly type: "guest-level-set"; readonly tenths: LevelTenths }
  | { readonly type: "guest-level-closed" };

export type AddPlayerAction = SheetAction | GuestAction;

export const initialAddPlayerState: AddPlayerState = {
  guestName: "",
  guestSheet: { kind: "closed" },
  lastGuest: null,
};

const CLOSED: GuestSheet = { kind: "closed" };

const GUEST_ACTIONS: ReadonlySet<AddPlayerAction["type"]> = new Set<GuestAction["type"]>([
  "guest-position-toggled",
  "guest-level-opened",
  "guest-level-drafted",
  "guest-level-set",
  "guest-level-closed",
]);

function isGuestAction(action: AddPlayerAction): action is GuestAction {
  return GUEST_ACTIONS.has(action.type);
}

function sheetReducer(state: AddPlayerState, action: SheetAction): AddPlayerState {
  switch (action.type) {
    case "guest-name-changed":
      return { ...state, guestName: action.name };
    case "guest-opened":
      if (state.guestSheet.kind === "open") return state;
      return {
        ...state,
        guestSheet: {
          kind: "open",
          step: "form",
          requestId: action.requestId,
          position: null,
          level: null,
          levelDraft: SKILL_LEVEL.defaultTenths,
        },
      };
    case "guest-closed":
      return { ...state, guestSheet: CLOSED };
    case "guest-added":
      return { guestName: "", guestSheet: CLOSED, lastGuest: action.guest };
    case "member-add-started":
      return { ...state, lastGuest: null };
  }
}

type OpenSheet = Extract<GuestSheet, { readonly kind: "open" }>;

function guestReducer(sheet: OpenSheet, action: GuestAction): OpenSheet {
  switch (action.type) {
    case "guest-position-toggled":
      return { ...sheet, position: sheet.position === action.position ? null : action.position };
    case "guest-level-opened":
      return { ...sheet, step: "level", levelDraft: sheet.level ?? SKILL_LEVEL.defaultTenths };
    case "guest-level-drafted":
      return { ...sheet, levelDraft: action.tenths };
    case "guest-level-set":
      return { ...sheet, step: "form", level: action.tenths };
    case "guest-level-closed":
      return { ...sheet, step: "form" };
  }
}

/** Pure: the calls and the IDs are made by the hook (frontend.md, rule 4). Two exhaustive switches. */
export function addPlayerReducer(state: AddPlayerState, action: AddPlayerAction): AddPlayerState {
  if (!isGuestAction(action)) return sheetReducer(state, action);
  if (state.guestSheet.kind !== "open") return state;
  return { ...state, guestSheet: guestReducer(state.guestSheet, action) };
}
