import { err, ok, type Result } from "../result.js";
import {
  ADDITIONAL_DATA_ID,
  ADDITIONAL_DATA_REFERENCE_ID,
  AMOUNT_ID,
  CENTS_DIGITS,
  CENTS_PER_REAL,
  COUNTRY_BRAZIL,
  COUNTRY_ID,
  CRC_HEX_LENGTH,
  CRC_ID,
  CURRENCY_BRL,
  CURRENCY_ID,
  MAX_AMOUNT_CENTS,
  MAX_MERCHANT_CITY_LENGTH,
  MAX_MERCHANT_NAME_LENGTH,
  MERCHANT_ACCOUNT_GUI_ID,
  MERCHANT_ACCOUNT_ID,
  MERCHANT_ACCOUNT_KEY_ID,
  MERCHANT_CATEGORY_ID,
  MERCHANT_CATEGORY_UNDEFINED,
  MERCHANT_CITY_ID,
  MERCHANT_NAME_ID,
  MIN_AMOUNT_CENTS,
  NO_TRANSACTION_REFERENCE,
  PAYLOAD_FORMAT,
  PAYLOAD_FORMAT_ID,
  PIX_GUI,
  TLV_LENGTH_DIGITS,
} from "./constants.data.js";
import { crc16CcittFalse } from "./crc16.js";
import { normalizeMerchantText } from "./normalize-text.js";
import type { PixPayloadError, PixPayloadInput } from "./types.js";
import { isValidPixKey } from "./validate-key.js";

/**
 * Builds the static Pix "copia e cola" code. The result contains the Pix key: callers must not
 * send it to logs, events, telemetry or URLs.
 */
export function buildPixPayload(input: PixPayloadInput): Result<string, PixPayloadError> {
  if (!isValidPixKey(input.key)) {
    return err({ code: "invalid-key" });
  }
  const merchantName = normalizeMerchantText(input.merchantName, MAX_MERCHANT_NAME_LENGTH);
  if (merchantName === "") {
    return err({ code: "invalid-merchant-name" });
  }
  const merchantCity = normalizeMerchantText(input.merchantCity, MAX_MERCHANT_CITY_LENGTH);
  if (merchantCity === "") {
    return err({ code: "invalid-merchant-city" });
  }
  if (input.amountCents !== undefined && !isValidAmountCents(input.amountCents)) {
    return err({ code: "invalid-amount" });
  }
  const unsigned = [
    tlv(PAYLOAD_FORMAT_ID, PAYLOAD_FORMAT),
    tlv(
      MERCHANT_ACCOUNT_ID,
      tlv(MERCHANT_ACCOUNT_GUI_ID, PIX_GUI) + tlv(MERCHANT_ACCOUNT_KEY_ID, input.key.value),
    ),
    tlv(MERCHANT_CATEGORY_ID, MERCHANT_CATEGORY_UNDEFINED),
    tlv(CURRENCY_ID, CURRENCY_BRL),
    input.amountCents === undefined ? "" : tlv(AMOUNT_ID, formatAmount(input.amountCents)),
    tlv(COUNTRY_ID, COUNTRY_BRAZIL),
    tlv(MERCHANT_NAME_ID, merchantName),
    tlv(MERCHANT_CITY_ID, merchantCity),
    tlv(ADDITIONAL_DATA_ID, tlv(ADDITIONAL_DATA_REFERENCE_ID, NO_TRANSACTION_REFERENCE)),
    crcHeader(),
  ].join("");
  return ok(unsigned + crc16CcittFalse(unsigned));
}

function isValidAmountCents(amountCents: number): boolean {
  return (
    Number.isSafeInteger(amountCents) &&
    amountCents >= MIN_AMOUNT_CENTS &&
    amountCents <= MAX_AMOUNT_CENTS
  );
}

/** Integer cents in, so the decimal part never depends on floating-point rounding. */
function formatAmount(amountCents: number): string {
  const reais = Math.floor(amountCents / CENTS_PER_REAL);
  const cents = String(amountCents % CENTS_PER_REAL).padStart(CENTS_DIGITS, "0");
  return `${String(reais)}.${cents}`;
}

function tlv(id: string, value: string): string {
  return id + tlvLength(value.length) + value;
}

/** The CRC covers its own ID and length, so they enter the payload before it is computed. */
function crcHeader(): string {
  return CRC_ID + tlvLength(CRC_HEX_LENGTH);
}

function tlvLength(length: number): string {
  return String(length).padStart(TLV_LENGTH_DIGITS, "0");
}
