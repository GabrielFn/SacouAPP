import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

import { ONBOARDING_ROUTES, SIGNED_IN_ROUTES, SIGNED_OUT_ROUTES } from "./navigation";

const APP = join(__dirname, "..", "..", "app");
const ROUTE_FILE = /\.tsx$/;
const LAYOUT = "_layout.tsx";

/** The names Expo Router gives the screens of the root stack: a folder with a layout is one screen. */
function routeNames(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return existsSync(join(path, LAYOUT)) ? [relative(APP, path)] : routeNames(path);
    }
    if (entry.name === LAYOUT || !ROUTE_FILE.test(entry.name)) return [];
    return [relative(APP, path).replace(ROUTE_FILE, "")];
  });
}

describe("the session gate of the root stack", () => {
  test("every route of src/app is behind the gate, in one list only", () => {
    const files = routeNames(APP).map((name) => name.split("\\").join("/"));
    const listed = [...SIGNED_IN_ROUTES, ...ONBOARDING_ROUTES, ...SIGNED_OUT_ROUTES];
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...files].sort());
  });

  test("signed out, only the login is reachable", () => {
    expect(SIGNED_OUT_ROUTES).toEqual(["sign-in"]);
  });

  test("the quick profile has its own guard; its edit mode is a plain signed-in route", () => {
    expect(ONBOARDING_ROUTES).toEqual(["onboarding"]);
    expect(SIGNED_IN_ROUTES).toContain("account/profile");
  });
});

describe("the root layout runs only real services", () => {
  const layout = readFileSync(join(APP, LAYOUT), "utf8");

  test("no fake adapter is imported (ESLint checks it too; a comment cannot turn this one off)", () => {
    expect(layout).not.toMatch(/fake-/);
  });

  test("the guard would catch a planted fake", () => {
    const planted = `${layout}\nimport { createFakeAuthSession } from "../adapters/fake-auth-session";\n`;
    expect(planted).toMatch(/fake-/);
  });

  test("the session is the Firebase one", () => {
    expect(layout).toMatch(/createFirebaseAuthSession\(/);
  });
});
