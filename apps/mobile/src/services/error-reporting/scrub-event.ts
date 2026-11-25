/**
 * The filter of everything the app sends to Sentry (E5.2, ADR 0080, D10), the mirror of the API's
 * `SentryEventScrubber`: allow lists, not deny lists. A field that is not known to be safe is dropped,
 * the text that stays loses e-mails, tokens and Pix codes, and a URL keeps only its route (`/r/{code}`).
 * Pure and without the SDK, so the tests run it on plain objects; the original is never changed.
 */

export const REDACTED = "[filtrado]";
export const REDACTED_ID = "[id]";
const CODE_SEGMENT = "{code}";

/** The approximate place of a user, as Sentry reads it; the SDK type fits in it. */
export interface ReportedGeo {
  readonly city?: string;
  readonly country_code?: string;
  readonly region?: string;
}

/** The user of an event, as Sentry reads it; the SDK type fits in it. */
export interface ReportedUser {
  readonly id?: string | number;
  readonly geo?: ReportedGeo;
}

/**
 * The only user any event carries (ADR 0080, D14), the same on every phone. Sentry derives
 * `user.geo` from the IP of the connection whenever the event has none, even with "Prevent Storing
 * of IP Addresses" and `sendDefaultPii: false` (Relay `normalize_user_geoinfo` falls back to the
 * client IP), so a geo that says nothing stops the lookup. The fixed `id` keeps the Android SDK
 * from filling the installation id (it only fills a missing one). Set on the scope too, so the
 * native SDK copies it into a native crash, which never passes through `beforeSend`.
 */
export const ANONYMOUS_USER: ReportedUser = { id: REDACTED_ID, geo: { region: REDACTED } };

/** The shape of a Sentry breadcrumb that the filter reads; the SDK type fits in it. */
export interface ReportedBreadcrumb {
  readonly category?: string;
  readonly message?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

/** How the exception was caught; `data` is free-form, so it never leaves. */
export interface ReportedMechanism {
  readonly type?: string;
  readonly handled?: boolean;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface ReportedException {
  readonly value?: string;
  readonly mechanism?: ReportedMechanism;
}

export interface ReportedLogEntry {
  readonly message?: string;
  readonly params?: readonly unknown[];
}

export interface ReportedRequest {
  readonly url?: string;
  readonly method?: string;
}

/** The shape of a Sentry event that the filter reads; the SDK type fits in it. */
export interface ReportedEvent {
  readonly message?: string;
  readonly transaction?: string;
  readonly logentry?: ReportedLogEntry;
  readonly user?: ReportedUser;
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
/**
 * The contexts that may leave and, in each one, the fields known to be safe: versions, model and
 * screen, never the name the owner gave the phone. Any other context or field is dropped.
 */
const ALLOWED_CONTEXT_FIELDS: Readonly<Record<string, readonly string[]>> = {
  app: ["app_identifier", "app_name", "app_version", "app_build", "build_type", "app_start_time"],
  os: ["name", "version", "build", "kernel_version", "rooted"],
  device: [
    "family",
    "model",
    "model_id",
    "brand",
    "manufacturer",
    "arch",
    "simulator",
    "orientation",
    "battery_level",
    "charging",
    "online",
    "low_memory",
    "memory_size",
    "free_memory",
    "storage_size",
    "free_storage",
    "screen_density",
    "screen_dpi",
    "screen_height_pixels",
    "screen_width_pixels",
    "processor_count",
    "boot_time",
  ],
  react: ["version"],
  runtime: ["name", "version", "raw_description"],
};
const TOUCH_CATEGORY = "touch";

/**
 * E-mails, tokens, Pix codes, codes in links and the query of a link become `[filtrado]` or a route;
 * every GUID becomes `[id]`, as in the API, so no `MemberId` leaves.
 */
export function redactText(text: string): string {
  const withoutTails = text.replace(URL_TAIL_PATTERN, "$1");
  const withoutCodes = withoutTails.replace(CODE_PATH_PATTERN, `/$1/${CODE_SEGMENT}`);
  const withoutIds = withoutCodes.replace(GUID_PATTERN, REDACTED_ID);
  return SENSITIVE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    withoutIds,
  );
}

/** The route of a URL: no query, no fragment, codes as `{code}` and ids as `[id]`. */
export function scrubUrl(url: string): string {
  const [path = ""] = url.split(QUERY_OR_FRAGMENT);
  return redactText(path);
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

/** A primitive value, with its text filtered; objects and arrays are dropped. */
function scrubPrimitive(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  return typeof value === "number" || typeof value === "boolean" ? value : undefined;
}

/** Only the allowed contexts and, in each one, only its allowed fields (allow list). */
function allowedContexts(
  contexts: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (contexts === undefined) return undefined;
  return Object.fromEntries(
    Object.entries(ALLOWED_CONTEXT_FIELDS).flatMap(([name, fields]) => {
      const context = contexts[name];
      return isRecord(context) ? [[name, pick(context, fields, scrubPrimitive)]] : [];
    }),
  );
}

/** The mechanism keeps how the error was caught; its free-form `data` is dropped. */
function scrubMechanism<M extends ReportedMechanism>(mechanism: M | undefined): M | undefined {
  return mechanism === undefined ? undefined : { ...mechanism, data: undefined };
}

function scrubLogEntry<L extends ReportedLogEntry>(logentry: L | undefined): L | undefined {
  if (logentry === undefined) return undefined;
  return {
    ...logentry,
    message: redactOptional(logentry.message),
    params: logentry.params?.map(scrubPrimitive),
  };
}

/** The event as it may leave the phone; the original is not changed. */
export function scrubEvent<E extends ReportedEvent>(event: E): E {
  return {
    ...event,
    user: ANONYMOUS_USER,
    server_name: undefined,
    extra: undefined,
    request: scrubRequest(event.request),
    message: redactOptional(event.message),
    transaction: redactOptional(event.transaction),
    logentry: scrubLogEntry(event.logentry),
    exception:
      event.exception === undefined
        ? undefined
        : {
            ...event.exception,
            values: event.exception.values?.map((value) => ({
              ...value,
              value: redactOptional(value.value),
              mechanism: scrubMechanism(value.mechanism),
            })),
          },
    breadcrumbs: event.breadcrumbs?.flatMap((breadcrumb) => {
      const scrubbed = scrubBreadcrumb(breadcrumb);
      return scrubbed === null ? [] : [scrubbed];
    }),
    tags: allowedTags(event.tags),
    contexts: allowedContexts(event.contexts),
  };
}
