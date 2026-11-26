import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, it } from "node:test";
import { URL, fileURLToPath } from "node:url";

import { findEasConfigViolations, findStoreDotenvViolations } from "./eas-config.mjs";

const EAS_PATH = new URL("../../apps/mobile/eas.json", import.meta.url);
const APP_PATH = new URL("../../apps/mobile/app.json", import.meta.url);
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_ID = "6ebec243-d104-4750-a5a2-8f0ab0e548db";

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}

function validEas() {
  return {
    cli: { appVersionSource: "remote" },
    build: {
      preview: { channel: "preview", autoIncrement: true, android: { buildType: "apk" } },
      production: {
        environment: "production",
        channel: "production",
        autoIncrement: true,
        android: { buildType: "app-bundle" },
        env: { EXPO_PUBLIC_SENTRY_ENVIRONMENT: "production" },
      },
    },
  };
}

function validApp() {
  return {
    expo: {
      runtimeVersion: { policy: "fingerprint" },
      updates: { url: `https://u.expo.dev/${PROJECT_ID}` },
      extra: { eas: { projectId: PROJECT_ID } },
    },
  };
}

function withProduction(change) {
  const eas = validEas();
  return { ...eas, build: { ...eas.build, production: change(eas.build.production) } };
}

function violations(eas, app = validApp()) {
  return findEasConfigViolations({ eas, app });
}

function without(object, key) {
  return Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));
}

function withExpo(change) {
  return { expo: change(validApp().expo) };
}

function trackedMobileDotenvFiles() {
  const output = execFileSync("git", ["ls-files", "-z", "--", "apps/mobile/.env*"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return output
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => ({
      name: basename(path),
      content: readFileSync(join(REPO_ROOT, path), "utf8"),
    }));
}

describe("findEasConfigViolations", () => {
  it("passes the repository eas.json", () => {
    assert.deepEqual(violations(readJson(EAS_PATH), readJson(APP_PATH)), []);
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
    const build = { ...eas.build, preview: { ...eas.build.preview, autoIncrement: false } };
    assert.deepEqual(violations({ ...eas, build }), ["preview: autoIncrement must be true"]);
  });

  it("fails when production listens to the preview update channel", () => {
    const eas = withProduction((p) => ({ ...p, channel: "preview" }));
    assert.deepEqual(violations(eas), ['production: channel must be "production"']);
  });

  it("fails when preview has no update channel", () => {
    const eas = validEas();
    const preview = without(eas.build.preview, "channel");
    assert.deepEqual(violations({ ...eas, build: { ...eas.build, preview } }), [
      'preview: channel must be "preview"',
    ]);
  });

  it("fails when the runtime version follows the app version", () => {
    const app = withExpo((e) => ({ ...e, runtimeVersion: { policy: "appVersion" } }));
    assert.deepEqual(violations(validEas(), app), [
      'app.json: runtimeVersion.policy must be "fingerprint"',
    ]);
  });

  it("fails when updates.url points to another EAS project", () => {
    const app = withExpo((e) => ({ ...e, updates: { url: "https://u.expo.dev/other" } }));
    assert.deepEqual(violations(validEas(), app), [
      'app.json: updates.url must be "https://u.expo.dev/<extra.eas.projectId>"',
    ]);
  });

  it("fails when production has no update channel", () => {
    const eas = withProduction((p) => without(p, "channel"));
    assert.deepEqual(violations(eas), ['production: channel must be "production"']);
  });

  it("fails when app.json has no EAS project id", () => {
    const app = withExpo((e) => ({ ...e, extra: {} }));
    assert.deepEqual(violations(validEas(), app), [
      'app.json: updates.url must be "https://u.expo.dev/<extra.eas.projectId>"',
    ]);
  });

  it("fails without updates.url", () => {
    const app = withExpo((e) => without(e, "updates"));
    assert.equal(violations(validEas(), app).length, 1);
  });
});

describe("findStoreDotenvViolations", () => {
  it("passes the dotenv files tracked in apps/mobile", () => {
    assert.deepEqual(findStoreDotenvViolations(trackedMobileDotenvFiles()), []);
  });

  it("fails when a tracked .env.production turns on the dev tools or sets the API", () => {
    const content = "EXPO_PUBLIC_DEV_TOOLS=1\nexport EXPO_PUBLIC_API_URL=http://10.0.2.2:5000\n";
    assert.deepEqual(findStoreDotenvViolations([{ name: ".env.production", content }]), [
      "apps/mobile/.env.production: EXPO_PUBLIC_DEV_TOOLS must not be tracked",
      "apps/mobile/.env.production: EXPO_PUBLIC_API_URL must not be tracked",
    ]);
  });

  it("ignores comments, other keys and files the store bundle does not load", () => {
    const files = [
      { name: ".env", content: "# EXPO_PUBLIC_DEV_TOOLS=1\nEXPO_PUBLIC_SENTRY_DSN=x\n" },
      { name: ".env.example", content: "EXPO_PUBLIC_API_URL=\n" },
      { name: ".env.development", content: "EXPO_PUBLIC_DEV_TOOLS=1\n" },
    ];
    assert.deepEqual(findStoreDotenvViolations(files), []);
  });
});
