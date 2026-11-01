import { expect, test } from "vitest";

import { err, ok } from "./result.js";

test("ok carries the value", () => {
  expect(ok(1)).toStrictEqual({ ok: true, value: 1 });
});

test("err carries the error", () => {
  expect(err("failure")).toStrictEqual({ ok: false, error: "failure" });
});
