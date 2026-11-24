/**
 * The filter of everything the app sends to Sentry (E5.2, ADR 0080, D10), the mirror of the API's
 * `SentryEventScrubber`: allow lists, not deny lists. A field that is not known to be safe is dropped,
 * the text that stays loses e-mails, tokens and Pix codes, and a URL keeps only its route (`/r/{code}`).
 * Pure and without the SDK, so the tests run it on plain objects; the original is never changed.
 */

export const REDACTED = "[filtrado]";
export const REDACTED_ID = "[id]";
const CODE_SEGMENT = "{code}";

/** The shape of a Sentry breadcrumb that the filter reads; the SDK type fits in it. */
export interface ReportedBreadcrumb {
  readonly category?: string;
  readonly message?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface ReportedException {
  readonly value?: string;
}

export interface ReportedRequest {
  readonly url?: string;
  readonly method?: string;
}

/** The shape of a Sentry event that the filter reads; the SDK type fits in it. */
export interface ReportedEvent {
  readonly message?: string;
  readonly user?: unknown;
  readonly server_name?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly request?: ReportedRequest;
  readonly exception?: { readonly values?: readonly ReportedException[] };
  readonly breadcrumbs?: readonly ReportedBreadcrumb[];
  readonly tags?: Readonly<Record<string, unknown>>;
  readonly contexts?: Readonly<Record<string, unknown>>;
}

// The same patterns as the API's SensitiveText: bearer token, JWT (`{"` is `eyJ` in base64url), the EMV
// payload of a Pix code (`000201...`) and e-mail.
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /\bBearer\s+\S+/gi,
  /\beyJ[A-Za-z0-9_-]*(\.[A-Za-z0-9_-]*)*/g,
  /000201\S*/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
];
const GUID_PATTERN =
  /\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/g;
/** The invite (`/c`) and round (`/r`) codes, in a web link or a `sacou://` deep link. */
const CODE_PATH_PATTERN = /\/(c|r)\/[^/?#\s]+/g;
/** A query or fragment of a URL written inside a text; the invite token goes after the `#`. */
const URL_TAIL_PATTERN = /((?:https?|sacou):\/\/[^\s?#]*)[?#]\S*/g;
const QUERY_OR_FRAGMENT = /[?#]/;

const ALLOWED_TAGS: readonly string[] = ["area", "event.origin", "event.environment"];
const HTTP_CATEGORIES: readonly string[] = ["xhr", "fetch", "http"];
const NAVIGATION_CATEGORIES: readonly string[] = ["navigation", "deeplink"];
const HTTP_DATA_KEYS: readonly string[] = ["method", "status_code"];
const NAVIGATION_URL_KEYS: readonly string[] = ["from", "to", "url"];
const CONSOLE_CATEGORY = "console";
const TOUCH_CATEGORY = "touch";

/** E-mails, tokens, Pix codes, codes in links and the query of a link become `[filtrado]` or a route. */
export function redactText(text: string): string {
  const withoutTails = text.replace(URL_TAIL_PATTERN, "$1");
  const withoutCodes = withoutTails.replace(CODE_PATH_PATTERN, `/$1/${CODE_SEGMENT}`);
  return SENSITIVE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    withoutCodes,
  );
}

/** The route of a URL: no query, no fragment, codes as `{code}` and ids as `[id]`. */
export function scrubUrl(url: string): string {
  const [path = ""] = url.split(QUERY_OR_FRAGMENT);
  return redactText(path).replace(GUID_PATTERN, REDACTED_ID);
}

function redactOptional(text: string | undefined): string | undefined {
  return text === undefined ? undefined : redactText(text);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(
  data: Readonly<Record<string, unknown>> | undefined,
  keys: readonly string[],
  scrub: (value: unknown) => unknown,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    keys.flatMap((key) => (data?.[key] === undefined ? [] : [[key, scrub(data[key])]])),
  );
}

const keep = (value: unknown): unknown => value;
const scrubUrlValue = (value: unknown): unknown =>
  typeof value === "string" ? scrubUrl(value) : undefined;

/** Only the component names of a touch: the label may be a nickname shown on the button. */
function touchPath(data: Readonly<Record<string, unknown>> | undefined): readonly unknown[] {
  const path = data?.path;
  if (!Array.isArray(path)) return [];
  return path.flatMap((step: unknown) =>
    isRecord(step) && typeof step.name === "string" ? [{ name: step.name }] : [],
  );
}

/** The breadcrumb as Sentry may keep it, or `null` to drop it (console lines are never kept). */
export function scrubBreadcrumb<B extends ReportedBreadcrumb>(breadcrumb: B): B | null {
  const { category, data } = breadcrumb;
  if (category === CONSOLE_CATEGORY) return null;
  if (category !== undefined && HTTP_CATEGORIES.includes(category)) {
    return {
      ...breadcrumb,
      message: undefined,
      data: { ...pick(data, HTTP_DATA_KEYS, keep), ...pick(data, ["url"], scrubUrlValue) },
    };
  }
  if (category !== undefined && NAVIGATION_CATEGORIES.includes(category)) {
    return {
      ...breadcrumb,
      message: breadcrumb.message === undefined ? undefined : scrubUrl(breadcrumb.message),
      data: pick(data, NAVIGATION_URL_KEYS, scrubUrlValue),
    };
  }
  if (category === TOUCH_CATEGORY) {
    return { ...breadcrumb, message: undefined, data: { path: touchPath(data) } };
  }
  return { ...breadcrumb, message: redactOptional(breadcrumb.message), data: undefined };
}

function scrubRequest(request: ReportedRequest | undefined): ReportedRequest | undefined {
  if (request === undefined) return undefined;
  return {
    url: request.url === undefined ? undefined : scrubUrl(request.url),
    method: request.method,
  };
}

function allowedTags(
  tags: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  return tags === undefined ? undefined : pick(tags, ALLOWED_TAGS, keep);
}

/** The device context keeps the model and the system, never the name the owner gave the phone. */
function withoutDeviceName(
  contexts: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  const device = contexts?.device;
  if (contexts === undefined || !isRecord(device)) return contexts;
  return { ...contexts, device: { ...device, name: undefined } };
}

/** The event as it may leave the phone; the original is not changed. */
export function scrubEvent<E extends ReportedEvent>(event: E): E {
  return {
    ...event,
    user: undefined,
    server_name: undefined,
    extra: undefined,
    request: scrubRequest(event.request),
    message: redactOptional(event.message),
    exception:
      event.exception === undefined
        ? undefined
        : {
            ...event.exception,
            values: event.exception.values?.map((value) => ({
              ...value,
              value: redactOptional(value.value),
            })),
          },
    breadcrumbs: event.breadcrumbs?.flatMap((breadcrumb) => {
      const scrubbed = scrubBreadcrumb(breadcrumb);
      return scrubbed === null ? [] : [scrubbed];
    }),
    tags: allowedTags(event.tags),
    contexts: withoutDeviceName(event.contexts),
  };
}
