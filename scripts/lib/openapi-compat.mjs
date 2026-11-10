// Compatibility of /v1 (ADR 0039, Consequences; ADR 0042, D3): compares the contract of a PR with the one on
// main and lists what would break an app already installed. Pure: two parsed documents in, messages out.
const JSON_CONTENT = "application/json";
const SCHEMA_REF_PREFIX = "#/components/schemas/";
const SUCCESS_STATUS = /^2\d\d$/;
const HTTP_METHODS = new Set(["get", "put", "post", "delete", "patch", "head", "options"]);

export const BREAKING_MARK = "BREAKING-V1";

function resolveSchema(document, schema) {
  const reference = schema?.$ref;
  if (typeof reference !== "string" || !reference.startsWith(SCHEMA_REF_PREFIX)) {
    return schema ?? {};
  }
  return document.components?.schemas?.[reference.slice(SCHEMA_REF_PREFIX.length)] ?? {};
}

function operationsOf(document) {
  return Object.entries(document.paths ?? {}).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method]) => HTTP_METHODS.has(method))
      .map(([method, operation]) => ({ key: `${method.toUpperCase()} ${path}`, operation })),
  );
}

function requiredOf(schema) {
  return new Set(schema.required ?? []);
}

function enumChanges(base, head, where) {
  if (!Array.isArray(base.enum)) return [];
  const kept = new Set(head.enum ?? []);
  return base.enum
    .filter((value) => !kept.has(value))
    .map((value) => `${where}: enum value "${value}" removed`);
}

function requestRequiredChanges(base, head, where) {
  const before = requiredOf(base);
  const known = new Set(Object.keys(base.properties ?? {}));
  return [...requiredOf(head)]
    .filter((name) => !before.has(name))
    .map((name) =>
      known.has(name)
        ? `${where}.${name}: request field became required`
        : `${where}.${name}: new required request field`,
    );
}

/** Walks two schemas side by side; `direction` is "request" or "response". `seen` stops reference cycles. */
function schemaChanges(context, baseSchema, headSchema, where, seen = new Set()) {
  const { baseDocument, headDocument, direction } = context;
  const reference = baseSchema?.$ref;
  if (reference !== undefined && seen.has(reference)) return [];
  const nextSeen = reference === undefined ? seen : new Set([...seen, reference]);
  const base = resolveSchema(baseDocument, baseSchema);
  const head = resolveSchema(headDocument, headSchema);
  const items = base.items
    ? schemaChanges(context, base.items, head.items ?? {}, `${where}[]`, nextSeen)
    : [];
  const properties = Object.entries(base.properties ?? {}).flatMap(([name, property]) =>
    head.properties?.[name] === undefined
      ? [`${where}.${name}: ${direction} field removed`]
      : schemaChanges(context, property, head.properties[name], `${where}.${name}`, nextSeen),
  );
  const required = direction === "request" ? requestRequiredChanges(base, head, where) : [];
  return [...enumChanges(base, head, where), ...items, ...properties, ...required];
}

function jsonSchemaOf(holder) {
  return holder?.content?.[JSON_CONTENT]?.schema;
}

function operationChanges(baseDocument, headDocument, key, base, head) {
  const request = jsonSchemaOf(base.requestBody);
  const requestChanges = request
    ? schemaChanges(
        { baseDocument, headDocument, direction: "request" },
        request,
        jsonSchemaOf(head.requestBody) ?? {},
        `${key} request`,
      )
    : [];
  const responseChanges = Object.entries(base.responses ?? {})
    .filter(([status]) => SUCCESS_STATUS.test(status))
    .flatMap(([status, response]) => {
      const schema = jsonSchemaOf(response);
      if (!schema) return [];
      const headResponse = head.responses?.[status];
      if (!headResponse) return [`${key} ${status}: response removed`];
      return schemaChanges(
        { baseDocument, headDocument, direction: "response" },
        schema,
        jsonSchemaOf(headResponse) ?? {},
        `${key} ${status}`,
      );
    });
  return [...requestChanges, ...responseChanges];
}

/** Every change that breaks an installed app; an empty list means the PR keeps /v1 compatible. */
export function findBreakingChanges(baseDocument, headDocument) {
  const headOperations = new Map(
    operationsOf(headDocument).map(({ key, operation }) => [key, operation]),
  );
  return operationsOf(baseDocument).flatMap(({ key, operation }) =>
    headOperations.has(key)
      ? operationChanges(baseDocument, headDocument, key, operation, headOperations.get(key))
      : [`${key}: route or method removed`],
  );
}

/** The exception: the PR body says BREAKING-V1 (and the PR brings the ADR that justifies it). */
export function isBreakingAllowed(pullRequestBody) {
  return typeof pullRequestBody === "string" && pullRequestBody.includes(BREAKING_MARK);
}
