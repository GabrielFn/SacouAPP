export const PIX_KEY_TYPES = Object.freeze(["cpf", "cnpj", "phone", "email", "random"] as const);

/** Field IDs of the static BR Code. */
export const PAYLOAD_FORMAT_ID = "00";
export const MERCHANT_ACCOUNT_ID = "26";
export const MERCHANT_ACCOUNT_GUI_ID = "00";
export const MERCHANT_ACCOUNT_KEY_ID = "01";
export const MERCHANT_CATEGORY_ID = "52";
export const CURRENCY_ID = "53";
export const AMOUNT_ID = "54";
export const COUNTRY_ID = "58";
export const MERCHANT_NAME_ID = "59";
export const MERCHANT_CITY_ID = "60";
export const ADDITIONAL_DATA_ID = "62";
export const ADDITIONAL_DATA_REFERENCE_ID = "05";
export const CRC_ID = "63";

export const PAYLOAD_FORMAT = "01";
export const PIX_GUI = "br.gov.bcb.pix";
export const MERCHANT_CATEGORY_UNDEFINED = "0000";
export const CURRENCY_BRL = "986";
export const COUNTRY_BRAZIL = "BR";
/** A static code without a transaction ID must say so with this value. */
export const NO_TRANSACTION_REFERENCE = "***";

export const TLV_LENGTH_DIGITS = 2;

export const MAX_MERCHANT_NAME_LENGTH = 25;
export const MAX_MERCHANT_CITY_LENGTH = 15;
export const MAX_KEY_LENGTH = 77;

export const MIN_AMOUNT_CENTS = 1;
/** Formats as 9999999999.99, the 13 characters the amount field allows. */
export const MAX_AMOUNT_CENTS = 999_999_999_999;
export const CENTS_PER_REAL = 100;
export const CENTS_DIGITS = 2;

export const CRC_POLYNOMIAL = 0x1021;
export const CRC_INITIAL = 0xffff;
export const CRC_MASK = 0xffff;
export const CRC_HIGH_BIT = 0x8000;
export const CRC_BYTE_SHIFT = 8;
export const CRC_BITS_PER_BYTE = 8;
export const CRC_HEX_RADIX = 16;
export const CRC_HEX_LENGTH = 4;

/**
 * `[0-9]` instead of `\d`, and no `\s` or `\w`: these must mean the same in the C# port, where
 * `\d` also matches non-ASCII digits. The trailing-newline golden cases guard C#'s `$`.
 */
export const KEY_PATTERNS = Object.freeze({
  cpf: /^[0-9]{11}$/u,
  cnpj: /^[0-9A-Z]{14}$/u,
  phone: /^\+55[0-9]{11}$/u,
  email: /^[\x21-\x3F\x41-\x7E]+@[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)+$/u,
  random: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
} as const);

/** An explicit list, because `\s` differs between JS and .NET. */
export const SPACE_LOOKALIKE = /[\t\u00A0]/gu;
export const NON_PRINTABLE_ASCII = /[^\x20-\x7E]/gu;
export const SPACE_RUN = / +/gu;
