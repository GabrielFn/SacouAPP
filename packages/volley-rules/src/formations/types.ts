import type {
  FORMATION_SYSTEMS,
  PLAYER_ROLES,
  ROTATION_KEYS,
  ROTATION_SLOTS,
} from "./constants.data.js";

export type RotationSlot = (typeof ROTATION_SLOTS)[number];
export type SetterZone = RotationSlot;
export type RotationKey = (typeof ROTATION_KEYS)[number];
export type FormationSystem = (typeof FORMATION_SYSTEMS)[number];
export type PlayerRole = (typeof PLAYER_ROLES)[number];
export type FormationPhase = "receiving" | "serving";

export interface CourtPoint {
  readonly x: number;
  readonly y: number;
}

export interface FormationSlot {
  readonly role: PlayerRole;
  readonly point: CourtPoint;
}

/** The formation of one team in one rotation and phase. */
export interface Formation {
  readonly system: FormationSystem;
  readonly rotation: RotationKey;
  readonly phase: FormationPhase;
  readonly slots: Readonly<Record<RotationSlot, FormationSlot>>;
  readonly liberoReplaces: PlayerRole | null;
  readonly note: string;
}

export interface ReceivePosition extends CourtPoint {
  readonly role: PlayerRole;
}

/** A raw catalog entry. The serving phase is derived from it and the base positions. */
export interface FormationTemplate {
  readonly receive: Readonly<Record<RotationSlot, ReceivePosition>>;
  readonly liberoReplaces: PlayerRole | null;
  readonly serveSubstitution: Readonly<Partial<Record<RotationSlot, PlayerRole>>> | null;
  readonly note: string;
}

export interface FormationSystemTemplate {
  readonly label: string;
  readonly rotationOrder: readonly RotationKey[];
  readonly rotations: Readonly<Partial<Record<RotationKey, FormationTemplate>>>;
}

export interface FormationCatalog {
  readonly basePositions: Readonly<Record<RotationSlot, CourtPoint>>;
  readonly systems: Readonly<Record<FormationSystem, FormationSystemTemplate>>;
}
