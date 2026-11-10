import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";

import {
  contractHashOf,
  errorCodesOf,
  GENERATED_FILES,
  generateApiTypes,
  staleFiles,
} from "./api-types.mjs";

const FIXTURES = join(import.meta.dirname, "fixtures", "api-types");
const OUTPUT = resolve(
  import.meta.dirname,
  "..",
  "..",
  "apps",
  "mobile",
  "src",
  "api",
  "generated",
);
const documentText = readFileSync(join(FIXTURES, "contract.json"), "utf8");
const golden = (name) => readFileSync(join(FIXTURES, `${name}.golden`), "utf8");

describe("generate-api-types (S1, S2)", () => {
  test("a sample contract gives the golden files", async () => {
    const files = await generateApiTypes(documentText, OUTPUT);

    for (const name of Object.values(GENERATED_FILES)) {
      assert.equal(files[name], golden(name), name);
    }
  });

  test("the same contract gives the same text twice", async () => {
    assert.deepEqual(
      await generateApiTypes(documentText, OUTPUT),
      await generateApiTypes(documentText, OUTPUT),
    );
  });

  test("an edited or missing file is stale, an untouched one is not", async () => {
    const files = await generateApiTypes(documentText, OUTPUT);
    const edited = {
      ...files,
      [GENERATED_FILES.schema]: `${files[GENERATED_FILES.schema]}// edited\n`,
    };

    assert.deepEqual(
      staleFiles(files, (name) => files[name]),
      [],
    );
    assert.equal(staleFiles(files, (name) => edited[name]).length, 1);
    assert.equal(staleFiles(files, () => undefined).length, Object.keys(files).length);
  });

  test("a contract without error codes is refused", () => {
    assert.throws(() => errorCodesOf({}), /x-sacou-error-codes/);
    assert.throws(() => errorCodesOf({ "x-sacou-error-codes": [] }), /x-sacou-error-codes/);
    assert.throws(() => errorCodesOf({ "x-sacou-error-codes": [1] }), /x-sacou-error-codes/);
  });

  test("the hash ignores CRLF and follows the content", () => {
    assert.equal(contractHashOf("{\r\n}"), contractHashOf("{\n}"));
    assert.notEqual(contractHashOf("{\n}"), contractHashOf("{ }"));
  });
});
