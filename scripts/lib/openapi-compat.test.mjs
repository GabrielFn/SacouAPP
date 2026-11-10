import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test } from "node:test";

import { findBreakingChanges, isBreakingAllowed } from "./openapi-compat.mjs";

const CONTRACT = resolve(import.meta.dirname, "..", "..", "apps", "api", "openapi", "v1.json");

/** A small /v1 with one route: a request with a required and an optional field, a response with an enum. */
function contract() {
  return {
    paths: {
      "/v1/groups": {
        post: {
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
          },
        },
        Response: {
          type: "object",
          required: ["groupId", "role"],
          properties: {
            groupId: { type: "string" },
            role: { $ref: "#/components/schemas/Role" },
            members: { type: "array", items: { $ref: "#/components/schemas/Member" } },
          },
        },
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
  ];

  for (const [name, ...changes] of breaking) {
    test(`${name} breaks /v1`, () => {
      assert.equal(changed(...changes).length > 0, true);
    });
  }

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
  ];

  for (const [name, ...changes] of compatible) {
    test(`${name} keeps /v1`, () => {
      assert.deepEqual(changed(...changes), []);
    });
  }

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
