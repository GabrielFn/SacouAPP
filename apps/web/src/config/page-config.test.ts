import { describe, expect, it } from "vitest";

import { readPageConfig } from "./page-config";

const complete = {
  code: "K7fQ2xK7fQ2xK7fQ2x_-fQ",
  firebaseApiKey: "public-key",
  firebaseAuthDomain: "sacou-79493.firebaseapp.com",
  firebaseProjectId: "sacou-79493",
  firebaseAppId: "1:2:web:3",
  nicknameMax: "20",
};

describe("readPageConfig", () => {
  it("reads the code and the public Firebase config of the data attributes", () => {
    expect(readPageConfig(complete)).toEqual({
      code: complete.code,
      firebase: {
        apiKey: "public-key",
        authDomain: "sacou-79493.firebaseapp.com",
        projectId: "sacou-79493",
        appId: "1:2:web:3",
      },
      nicknameMaxCodePoints: 20,
      dropIn: { phrase: "", hasRegulars: false },
    });
  });

  it("reads the avulsos window phrase and whether the list has mensalistas", () => {
    const config = readPageConfig({
      ...complete,
      dropInPhrase: " hoje, às 20h ",
      hasRegulars: "true",
    });
    expect(config?.dropIn).toEqual({ phrase: "hoje, às 20h", hasRegulars: true });
  });

  it.each([
    ["no code", { ...complete, code: undefined }],
    ["a code out of shape", { ...complete, code: "short" }],
    ["no Firebase key", { ...complete, firebaseApiKey: " " }],
    ["no app id", { ...complete, firebaseAppId: undefined }],
    ["no nickname limit", { ...complete, nicknameMax: "x" }],
  ])("leaves the page read-only with %s", (_, dataset) => {
    expect(readPageConfig(dataset)).toBeNull();
  });
});
