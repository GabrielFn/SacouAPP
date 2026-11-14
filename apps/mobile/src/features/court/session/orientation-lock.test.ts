import { describe, expect, test } from "vitest";

import { createFakeScreenOrientation } from "../../../adapters/fake-screen-orientation";
import { lockLandscapeUntilReleased } from "./orientation-lock";

describe("the court locks the phone on its side while it is open", () => {
  test("locks landscape once on opening and portrait on closing, never anything else", () => {
    const orientation = createFakeScreenOrientation();
    const release = lockLandscapeUntilReleased(orientation);
    expect(orientation.calls()).toEqual(["landscape"]);
    release();
    expect(orientation.calls()).toEqual(["landscape", "portrait"]);
  });

  test("going to the menu and back keeps the court mounted: no call in between", () => {
    const orientation = createFakeScreenOrientation();
    lockLandscapeUntilReleased(orientation);
    // The menu is a route of the same layout: nothing runs when it opens or closes.
    expect(orientation.calls()).toEqual(["landscape"]);
  });

  test("a refused lock does not break the court and still puts it upright at the end", async () => {
    const orientation = createFakeScreenOrientation({ rejectLandscape: true });
    const release = lockLandscapeUntilReleased(orientation);
    await Promise.resolve();
    release();
    expect(orientation.calls()).toEqual(["landscape", "portrait"]);
  });
});
