import type { PIX_KEY_TYPES } from "./constants.data.js";

export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export interface PixKey {
  readonly type: PixKeyType;
  /** Already in the DICT format: this module validates it and never rewrites it. */
  readonly value: string;
}

export interface PixPayloadInput {
  readonly key: PixKey;
  readonly merchantName: string;
  readonly merchantCity: string;
  /** Whole cents, never a float. Absent means that the payer types the amount. */
  readonly amountCents?: number;
}

/** Carries only a code: the key, the name and the city must never reach an error or a log. */
export interface PixPayloadError {
  readonly code:
    "invalid-key" | "invalid-merchant-name" | "invalid-merchant-city" | "invalid-amount";
}
