import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { findEasConfigViolations } from "./eas-config.mjs";

const EAS_PATH = new URL("../../apps/mobile/eas.json", import.meta.url);

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}

function validEas() {
  return {
    cli: { appVersionSource: "remote" },
    build: {
      preview: { autoIncrement: true, android: { buildType: "apk" } },
      production: {
        environment: "production",
        autoIncrement: true,
        android: { buildType: "app-bundle" },
        env: { EXPO_PUBLIC_SENTRY_ENVIRONMENT: "production" },
      },
    },
  };
}

function withProduction(change) {
  const eas = validEas();
  return { ...eas, build: { ...eas.build, production: change(eas.build.production) } };
}

function violations(eas) {
  return findEasConfigViolations({ eas });
}

describe("findEasConfigViolations", () => {
  it("passes the repository eas.json", () => {
    assert.deepEqual(violations(readJson(EAS_PATH)), []);
  });

  it("passes a valid config", () => {
    assert.deepEqual(violations(validEas()), []);
  });

  it("fails without the production profile", () => {
    const eas = validEas();
    const { preview } = eas.build;
    assert.deepEqual(violations({ ...eas, build: { preview } }), [
      "build.production profile is missing",
    ]);
  });

  it("fails when production builds an APK", () => {
    const eas = withProduction((p) => ({ ...p, android: { buildType: "apk" } }));
    assert.deepEqual(violations(eas), ['production: android.buildType must be "app-bundle"']);
  });

  it("fails when production does not increment the version code", () => {
    const eas = withProduction((p) => ({ ...p, autoIncrement: false }));
    assert.deepEqual(violations(eas), ["production: autoIncrement must be true"]);
  });

  it("fails when production reads another EAS environment", () => {
    const eas = withProduction((p) => ({ ...p, environment: "preview" }));
    assert.deepEqual(violations(eas), ['production: environment must be "production"']);
  });

  it("fails when production reports to the staging Sentry environment", () => {
    const eas = withProduction((p) => ({
      ...p,
      env: { EXPO_PUBLIC_SENTRY_ENVIRONMENT: "staging" },
    }));
    assert.deepEqual(violations(eas), [
      'production: env.EXPO_PUBLIC_SENTRY_ENVIRONMENT must be "production"',
    ]);
  });

  it("fails when production has the dev tools key, even turned off", () => {
    const eas = withProduction((p) => ({
      ...p,
      env: { ...p.env, EXPO_PUBLIC_DEV_TOOLS: "0" },
    }));
    assert.deepEqual(violations(eas), ["production: env.EXPO_PUBLIC_DEV_TOOLS must not exist"]);
  });

  it("fails when production skips or tolerates a failed source map upload", () => {
    const eas = withProduction((p) => ({
      ...p,
      env: { ...p.env, SENTRY_DISABLE_AUTO_UPLOAD: "true", SENTRY_ALLOW_FAILURE: "true" },
    }));
    assert.deepEqual(violations(eas), [
      "production: env.SENTRY_DISABLE_AUTO_UPLOAD must not exist",
      "production: env.SENTRY_ALLOW_FAILURE must not exist",
    ]);
  });

  it("fails when the version code comes from app.json", () => {
    const eas = { ...validEas(), cli: { appVersionSource: "local" } };
    assert.deepEqual(violations(eas), ['cli.appVersionSource must be "remote"']);
  });

  it("fails when preview does not increment the version code", () => {
    const eas = validEas();
    const build = { ...eas.build, preview: { android: { buildType: "apk" } } };
    assert.deepEqual(violations({ ...eas, build }), ["preview: autoIncrement must be true"]);
  });
});
