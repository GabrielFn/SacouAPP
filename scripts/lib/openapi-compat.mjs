// Compatibility of /v1 (ADR 0039, Consequences; ADR 0042, D3): compares the contract of a PR with the one on
// main and lists what would break an app already installed. Pure: two parsed documents in, messages out.
const JSON_CONTENT = "application/json";
const SCHEMA_REF_PREFIX = "#/components/schemas/";
const NULL_TYPE = "null";
const INTEGER_TYPE = "integer";
const NUMBER_TYPE = "number";
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
      .map(([method, operation]) => ({
        key: `${method.toUpperCase()} ${path}`,
        operation,
        parameters: [...(item.parameters ?? []), ...(operation.parameters ?? [])],
      })),
  );
}

/** The JSON types a schema allows, without "null"; an empty set means it says nothing about the type. */
function typesOf(schema) {
  const declared = schema.type === undefined ? [] : [schema.type].flat();
  return new Set(declared.filter((type) => type !== NULL_TYPE));
}

function isNullable(schema) {
  const alternatives = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
  return (
    [schema.type].flat().includes(NULL_TYPE) ||
    schema.nullable === true ||
    alternatives.some((alternative) => alternative.type === NULL_TYPE)
  );
}

/** Every type of `inner` is one of `outer`; an integer is also a number. */
function typesContained(inner, outer) {
  return [...inner].every(
    (type) => outer.has(type) || (type === INTEGER_TYPE && outer.has(NUMBER_TYPE)),
  );
}

/** The app reads what the API writes (head inside base) and the API reads what the app sends (base inside head). */
function typeChanges(base, head, where, direction) {
  const baseTypes = typesOf(base);
  const headTypes = typesOf(head);
  if (baseTypes.size === 0 || headTypes.size === 0) return [];
  const [inner, outer] = direction === "request" ? [baseTypes, headTypes] : [headTypes, baseTypes];
  return typesContained(inner, outer)
    ? []
    : [`${where}: ${direction} type changed from ${[...baseTypes]} to ${[...headTypes]}`];
}

function nullabilityChanges(base, head, where, direction) {
  if (direction === "response" && !isNullable(base) && isNullable(head)) {
    return [`${where}: response field became nullable`];
  }
  if (direction === "request" && isNullable(base) && !isNullable(head)) {
    return [`${where}: request field no longer accepts null`];
  }
  return [];
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

function responseRequiredChanges(base, head, where) {
  const after = requiredOf(head);
  return [...requiredOf(base)]
    .filter((name) => !after.has(name) && head.properties?.[name] !== undefined)
    .map((name) => `${where}.${name}: response field no longer required`);
}

/** `oneOf: [null, X]` (or `anyOf`) is X that may be null: the walk compares X. */
function withoutNullAlternative(schema) {
  const alternatives = [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])];
  const values = alternatives.filter((alternative) => alternative.type !== NULL_TYPE);
  return alternatives.length > 0 && values.length === 1 ? values[0] : schema;
}

/** The schema as declared (for nullability) and the value schema under it (for the rest). */
function shapeOf(document, schema) {
  const declared = resolveSchema(document, schema);
  return { declared, value: resolveSchema(document, withoutNullAlternative(declared)) };
}

/** The references walked so far, with this one; undefined when it was already walked (a cycle). */
function visit(schema, seen) {
  const reference = schema?.$ref ?? withoutNullAlternative(schema ?? {}).$ref;
  if (reference === undefined) return seen;
  return seen.has(reference) ? undefined : new Set([...seen, reference]);
}

/** Walks two schemas side by side; `direction` is "request" or "response". `seen` stops reference cycles. */
function schemaChanges(context, baseSchema, headSchema, where, seen = new Set()) {
  const { baseDocument, headDocument, direction } = context;
  const nextSeen = visit(baseSchema, seen);
  if (nextSeen === undefined) return [];
  const baseShape = shapeOf(baseDocument, baseSchema);
  const headShape = shapeOf(headDocument, headSchema);
  const base = baseShape.value;
  const head = headShape.value;
  const items = base.items
    ? schemaChanges(context, base.items, head.items ?? {}, `${where}[]`, nextSeen)
    : [];
  const properties = Object.entries(base.properties ?? {}).flatMap(([name, property]) =>
    head.properties?.[name] === undefined
      ? [`${where}.${name}: ${direction} field removed`]
      : schemaChanges(context, property, head.properties[name], `${where}.${name}`, nextSeen),
  );
  const required = (direction === "request" ? requestRequiredChanges : responseRequiredChanges)(
    base,
    head,
    where,
  );
  return [
    ...typeChanges(base, head, where, direction),
    ...nullabilityChanges(baseShape.declared, headShape.declared, where, direction),
    ...enumChanges(base, head, where),
    ...items,
    ...properties,
    ...required,
  ];
}

function jsonSchemaOf(holder) {
  return holder?.content?.[JSON_CONTENT]?.schema;
}

function parameterKey(parameter) {
  return `${parameter.in} ${parameter.name}`;
}

/** A parameter the app does not send yet, or one it may leave out, cannot become required. */
function parameterChanges(key, baseParameters, headParameters) {
  const optionalBefore = new Set(
    baseParameters.filter((parameter) => parameter.required !== true).map(parameterKey),
  );
  const knownBefore = new Set(baseParameters.map(parameterKey));
  return headParameters
    .filter((parameter) => parameter.required === true)
    .map(parameterKey)
    .filter((name) => !knownBefore.has(name) || optionalBefore.has(name))
    .map((name) =>
      knownBefore.has(name)
        ? `${key} parameter ${name}: became required`
        : `${key} parameter ${name}: new required parameter`,
    );
}

function requestBodyRequiredChanges(key, base, head) {
  return head.requestBody?.required === true && base.requestBody?.required !== true
    ? [`${key} request: body became required`]
    : [];
}

function operationChanges(baseDocument, headDocument, key, baseOperation, headOperation) {
  const { operation: base, parameters: baseParameters } = baseOperation;
  const { operation: head, parameters: headParameters } = headOperation;
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
  return [
    ...parameterChanges(key, baseParameters, headParameters),
    ...requestBodyRequiredChanges(key, base, head),
    ...requestChanges,
    ...responseChanges,
  ];
}

/** Every change that breaks an installed app; an empty list means the PR keeps /v1 compatible. */
export function findBreakingChanges(baseDocument, headDocument) {
  const headOperations = new Map(
    operationsOf(headDocument).map((operation) => [operation.key, operation]),
  );
  return operationsOf(baseDocument).flatMap((operation) =>
    headOperations.has(operation.key)
      ? operationChanges(
          baseDocument,
          headDocument,
          operation.key,
          operation,
          headOperations.get(operation.key),
        )
      : [`${operation.key}: route or method removed`],
  );
}

/** The exception: the PR body says BREAKING-V1 (and the PR brings the ADR that justifies it). */
export function isBreakingAllowed(pullRequestBody) {
  return typeof pullRequestBody === "string" && pullRequestBody.includes(BREAKING_MARK);
}
