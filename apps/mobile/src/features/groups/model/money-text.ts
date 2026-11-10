import { SETTINGS_CATALOG } from "@sacou/match-engine";

const CENTS_PER_REAL = 100;
const MAX_DECIMALS = 2;
const CURRENCY_PREFIX = /^R\$\s*/i;
/** "1.000", "10", "10,5", "10,50": dots only as thousands separators, comma only for cents. */
const MONEY_SHAPE = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;

const MONEY_MAX_CENTS =
  SETTINGS_CATALOG.fields.find((field) => field.path === "money.dropInFeeCents")?.max ?? 0;

/**
 * Reais as typed by a person to cents, without `Intl` (Hermes does not guarantee it). An empty text is
 * zero; a negative, a text that is not money and anything above the catalog maximum is `null`.
 */
export function parseBrlToCents(text: string): number | null {
  const typed = text.trim().replace(CURRENCY_PREFIX, "").trim();
  if (typed === "") return 0;
  if (!MONEY_SHAPE.test(typed)) return null;
  const [reais = "", cents = ""] = typed.replace(/\./g, "").split(",");
  const total = Number(reais) * CENTS_PER_REAL + Number(cents.padEnd(MAX_DECIMALS, "0"));
  return total <= MONEY_MAX_CENTS ? total : null;
}

const THOUSANDS_BOUNDARY = /\B(?=(\d{3})+(?!\d))/g;

function withThousands(reais: number): string {
  return String(reais).replace(THOUSANDS_BOUNDARY, ".");
}

/** 1000 → "R$ 10", 1050 → "R$ 10,50", 100000 → "R$ 1.000". */
export function formatCents(cents: number): string {
  const reais = Math.floor(cents / CENTS_PER_REAL);
  const rest = cents % CENTS_PER_REAL;
  const decimals = rest === 0 ? "" : `,${String(rest).padStart(MAX_DECIMALS, "0")}`;
  return `R$ ${withThousands(reais)}${decimals}`;
}

/** The text that fills a money field: empty for zero, as when the person has not typed yet. */
export function moneyFieldText(cents: number): string {
  return cents === 0 ? "" : formatCents(cents);
}
