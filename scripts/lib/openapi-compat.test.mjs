import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";

import { findBreakingChanges, isBreakingAllowed } from "./openapi-compat.mjs";

const CONTRACT = resolve(import.meta.dirname, "..", "..", "apps", "api", "openapi", "v1.json");

/**
 * A small /v1 with one route: an optional query parameter, an optional body with a required and an optional
 * field, and a response with an enum.
 */
function contract() {
  return {
    paths: {
      "/v1/groups": {
        post: {
          parameters: [{ name: "page", in: "query", schema: { type: "integer" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/Request" } } },
          },
          responses: {
            201: {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Response" } },
              },
            },
            409: {
              content: {
                "application/problem+json": { schema: { $ref: "#/components/schemas/ApiProblem" } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Request: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            note: { type: "string" },
            role: { $ref: "#/components/schemas/Role" },
            nickname: { $ref: "#/components/schemas/Nullable" },
            size: { $ref: "#/components/schemas/Size" },
          },
        },
        Response: {
          type: "object",
          required: ["groupId", "role"],
          properties: {
            groupId: { type: "string" },
            role: { $ref: "#/components/schemas/Role" },
            members: { type: "array", items: { $ref: "#/components/schemas/Member" } },
            count: { $ref: "#/components/schemas/Count" },
          },
        },
        Nullable: { type: ["null", "string"] },
        Size: { type: "integer" },
        Count: { type: "number" },
        Member: { type: "object", properties: { memberId: { type: "string" } } },
        Role: { type: "string", enum: ["admin", "player"] },
        ApiProblem: { type: "object", properties: { code: { type: "string" } } },
      },
    },
  };
}

const REMOVE = Symbol("remove");
const GROUPS = ["paths", "/v1/groups"];
const SCHEMAS = ["components", "schemas"];

/** Applies [keys, value] changes to a fresh copy; REMOVE deletes the key. Only locals are written. */
function changed(...changes) {
  const head = contract();
  for (const [keys, value] of changes) {
    const parent = keys.slice(0, -1).reduce((node, key) => node[key], head);
    const last = keys.at(-1);
    if (value === REMOVE) {
      delete parent[last];
    } else {
      parent[last] = value;
    }
  }
  return findBreakingChanges(contract(), head);
}

const text = { type: "string" };
const nullableText = { type: ["null", "string"] };
const POST = [...GROUPS, "post"];
const RESPONSE = [...SCHEMAS, "Response"];
const REQUEST = [...SCHEMAS, "Request"];

describe("check-openapi-compat (S3)", () => {
  test("the same contract is compatible", () => {
    assert.deepEqual(findBreakingChanges(contract(), contract()), []);
  });

  test("the committed contract is compatible with itself", () => {
    const document = JSON.parse(readFileSync(CONTRACT, "utf8"));
    assert.deepEqual(findBreakingChanges(document, document), []);
  });

  const breaking = [
    ["a removed route", [GROUPS, REMOVE]],
    [
      "a removed method",
      [[...GROUPS, "get"], contract().paths["/v1/groups"].post],
      [[...GROUPS, "post"], REMOVE],
    ],
    ["a removed request field", [[...SCHEMAS, "Request", "properties", "note"], REMOVE]],
    [
      "an optional request field made required",
      [
        [...SCHEMAS, "Request", "required"],
        ["name", "note"],
      ],
    ],
    [
      "a new required request field",
      [[...SCHEMAS, "Request", "properties", "city"], text],
      [
        [...SCHEMAS, "Request", "required"],
        ["name", "city"],
      ],
    ],
    ["a removed response field", [[...SCHEMAS, "Response", "properties", "groupId"], REMOVE]],
    [
      "a removed field inside a response list",
      [[...SCHEMAS, "Member", "properties", "memberId"], REMOVE],
    ],
    ["a removed response enum value", [[...SCHEMAS, "Role", "enum"], ["admin"]]],
    ["a removed success response", [[...GROUPS, "post", "responses", "201"], REMOVE]],
    ["a changed response type", [[...RESPONSE, "properties", "groupId"], { type: "integer" }]],
    [
      "a widened response type",
      [[...RESPONSE, "properties", "groupId"], { type: ["string", "integer"] }],
    ],
    ["a response field made nullable", [[...RESPONSE, "properties", "groupId"], nullableText]],
    [
      "a response field made nullable by a reference alternative",
      [
        [...RESPONSE, "properties", "role"],
        { oneOf: [{ type: "null" }, { $ref: "#/components/schemas/Role" }] },
      ],
    ],
    ["a response field no longer required", [[...RESPONSE, "required"], ["role"]]],
    ["a narrowed request type", [[...REQUEST, "properties", "name"], { type: "integer" }]],
    ["a request field that no longer accepts null", [[...SCHEMAS, "Nullable"], { type: "string" }]],
    [
      "a new required parameter",
      [
        [...POST, "parameters"],
        [
          { name: "page", in: "query" },
          { name: "city", in: "query", required: true },
        ],
      ],
    ],
    [
      "an optional parameter made required",
      [[...POST, "parameters"], [{ name: "page", in: "query", required: true }]],
    ],
    [
      "a new required path-level parameter",
      [[...GROUPS, "parameters"], [{ name: "id", in: "path", required: true }]],
    ],
    ["a request body made required", [[...POST, "requestBody", "required"], true]],
  ];

  /** The message each case must produce, so a case never passes on another rule's message. */
  const expectedMessage = {
    "a removed route": "POST /v1/groups: route or method removed",
    "a removed method": "POST /v1/groups: route or method removed",
    "a removed request field": "request.note: request field removed",
    "an optional request field made required": "request.note: request field became required",
    "a new required request field": "request.city: new required request field",
    "a removed response field": "201.groupId: response field removed",
    "a removed field inside a response list": "201.members[].memberId: response field removed",
    "a removed response enum value": '201.role: enum value "player" removed',
    "a removed success response": "201: response removed",
    "a changed response type": "201.groupId: response type changed from string to integer",
    "a widened response type": "201.groupId: response type changed from string to string,integer",
    "a response field made nullable": "201.groupId: response field became nullable",
    "a response field made nullable by a reference alternative":
      "201.role: response field became nullable",
    "a response field no longer required": "201.groupId: response field no longer required",
    "a narrowed request type": "request.name: request type changed from string to integer",
    "a request field that no longer accepts null":
      "request.nickname: request field no longer accepts null",
    "a new required parameter": "parameter query city: new required parameter",
    "an optional parameter made required": "parameter query page: became required",
    "a new required path-level parameter": "parameter path id: new required parameter",
    "a request body made required": "request: body became required",
  };

  for (const [name, ...changes] of breaking) {
    test(`${name} breaks /v1`, () => {
      const messages = changed(...changes);
      assert.ok(
        messages.some((message) => message.endsWith(expectedMessage[name])),
        messages.join("\n"),
      );
    });
  }

  test("a nullable reference is compared by the schema under it", () => {
    assert.deepEqual(
      changed([
        [...RESPONSE, "properties", "role"],
        { oneOf: [{ type: "null" }, { $ref: "#/components/schemas/Role" }] },
      ]),
      ["POST /v1/groups 201.role: response field became nullable"],
    );
  });

  const compatible = [
    ["a new optional request field", [[...SCHEMAS, "Request", "properties", "city"], text]],
    ["a new response field", [[...SCHEMAS, "Response", "properties", "city"], text]],
    ["a new route", [["paths", "/v1/sessions"], { get: { responses: {} } }]],
    [
      "a new enum value",
      [
        [...SCHEMAS, "Role", "enum"],
        ["admin", "player", "scorekeeper"],
      ],
    ],
    ["a changed error body", [[...SCHEMAS, "ApiProblem", "properties", "code"], REMOVE]],
    ["a request field that accepts null", [[...REQUEST, "properties", "name"], nullableText]],
    ["a request integer widened to number", [[...SCHEMAS, "Size"], { type: "number" }]],
    ["a response number narrowed to integer", [[...SCHEMAS, "Count"], { type: "integer" }]],
    [
      "a response field made required",
      [
        [...RESPONSE, "required"],
        ["groupId", "role", "members"],
      ],
    ],
    [
      "a new optional parameter",
      [
        [...POST, "parameters"],
        [
          { name: "page", in: "query" },
          { name: "city", in: "query" },
        ],
      ],
    ],
    ["a removed optional parameter", [[...POST, "parameters"], []]],
  ];

  for (const [name, ...changes] of compatible) {
    test(`${name} keeps /v1`, () => {
      assert.deepEqual(changed(...changes), []);
    });
  }

  test("declaring a segment of the route as a path parameter keeps /v1, any other one does not", () => {
    const route = (parameters) => ({ paths: { "/v1/groups/{groupId}": { get: { parameters } } } });
    const required = (name) => ({ name, in: "path", required: true });

    assert.deepEqual(findBreakingChanges(route([]), route([required("groupId")])), []);
    assert.deepEqual(findBreakingChanges(route([]), route([required("memberId")])), [
      "GET /v1/groups/{groupId} parameter path memberId: new required parameter",
    ]);
  });

  test("the message names the route and the field", () => {
    assert.deepEqual(changed([[...SCHEMAS, "Request", "properties", "note"], REMOVE]), [
      "POST /v1/groups request.note: request field removed",
    ]);
  });

  test("BREAKING-V1 in the PR body allows it, anything else does not", () => {
    assert.equal(isBreakingAllowed("Moves the route.\n\nBREAKING-V1: see ADR 0050"), true);
    assert.equal(isBreakingAllowed("breaking-v1"), false);
    assert.equal(isBreakingAllowed(undefined), false);
  });
});
