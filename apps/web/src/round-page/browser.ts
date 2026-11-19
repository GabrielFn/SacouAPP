/**
 * The in-app browsers where Google refuses the sign-in (`disallowed_useragent`): WhatsApp, Instagram, Facebook and the
 * Android WebView (`; wv)`). The page offers "Abra no navegador" and the e-mail there (ADR 0070, D4).
 */
const EMBEDDED_MARKERS: readonly RegExp[] = [
  /WhatsApp/i,
  /Instagram/i,
  /FBA[NV]\//,
  /FB_IAB/,
  /; wv\)/,
];

export function isEmbeddedBrowser(userAgent: string): boolean {
  return EMBEDDED_MARKERS.some((marker) => marker.test(userAgent));
}

/** The first word of the provider's name, as the nickname field's first value (question 129). Empty without a name. */
export function firstNameOf(displayName: string | null, maxCodePoints: number): string {
  const first = (displayName ?? "").trim().split(/\s+/u)[0] ?? "";
  return Array.from(first).slice(0, maxCodePoints).join("");
}
