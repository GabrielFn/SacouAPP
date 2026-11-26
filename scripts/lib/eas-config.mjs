// Rules for the store build profile of the mobile app (E5.4, ADR 0088).
// Only what changes the binary that reaches the Play Store is checked here;
// what only a real build shows (target SDK, signing) is checked by the runbook
// in docs/operacao/google-play.md.

export const STORE_PROFILE = "production";
export const PREVIEW_PROFILE = "preview";
export const STORE_BUILD_TYPE = "app-bundle";
export const STORE_SENTRY_ENVIRONMENT = "production";
export const RUNTIME_VERSION_POLICY = "fingerprint";
const UPDATES_HOST = "https://u.expo.dev/";

// Each store-like profile listens to its own EAS Update channel (E5.4 S2).
export const PROFILE_CHANNELS = Object.freeze({
  [PREVIEW_PROFILE]: "preview",
  [STORE_PROFILE]: "production",
});

// Keys that are fine on test builds and must never reach the store build:
// the developer screen switch and the switches that skip the source map upload.
export const FORBIDDEN_STORE_ENV_KEYS = Object.freeze([
  "EXPO_PUBLIC_DEV_TOOLS",
  "SENTRY_DISABLE_AUTO_UPLOAD",
  "SENTRY_ALLOW_FAILURE",
]);

function storeProfileViolations(profile) {
  const env = profile.env ?? {};
  const violations = [];
  if (profile.environment !== STORE_PROFILE) {
    violations.push(`${STORE_PROFILE}: environment must be "${STORE_PROFILE}"`);
  }
  if (profile.android?.buildType !== STORE_BUILD_TYPE) {
    violations.push(`${STORE_PROFILE}: android.buildType must be "${STORE_BUILD_TYPE}"`);
  }
  if (profile.autoIncrement !== true) {
    violations.push(`${STORE_PROFILE}: autoIncrement must be true`);
  }
  if (env.EXPO_PUBLIC_SENTRY_ENVIRONMENT !== STORE_SENTRY_ENVIRONMENT) {
    violations.push(
      `${STORE_PROFILE}: env.EXPO_PUBLIC_SENTRY_ENVIRONMENT must be "${STORE_SENTRY_ENVIRONMENT}"`,
    );
  }
  FORBIDDEN_STORE_ENV_KEYS.filter((key) => Object.hasOwn(env, key)).forEach((key) =>
    violations.push(`${STORE_PROFILE}: env.${key} must not exist`),
  );
  return violations;
}

function channelViolations(profiles) {
  return Object.entries(PROFILE_CHANNELS)
    .filter(([name, channel]) => profiles[name] !== undefined && profiles[name].channel !== channel)
    .map(([name, channel]) => `${name}: channel must be "${channel}"`);
}

function appViolations(app) {
  const expo = app.expo ?? {};
  const violations = [];
  if (expo.runtimeVersion?.policy !== RUNTIME_VERSION_POLICY) {
    violations.push(`app.json: runtimeVersion.policy must be "${RUNTIME_VERSION_POLICY}"`);
  }
  const projectId = expo.extra?.eas?.projectId;
  if (projectId === undefined || expo.updates?.url !== `${UPDATES_HOST}${projectId}`) {
    violations.push(`app.json: updates.url must be "${UPDATES_HOST}<extra.eas.projectId>"`);
  }
  return violations;
}

/**
 * @param {{ eas: object, app: object }} config parsed apps/mobile/eas.json and app.json
 * @returns {string[]} one message per broken rule, empty when the config is valid
 */
export function findEasConfigViolations({ eas, app }) {
  const violations = [];
  if (eas.cli?.appVersionSource !== "remote") {
    violations.push('cli.appVersionSource must be "remote"');
  }
  const profiles = eas.build ?? {};
  const store = profiles[STORE_PROFILE];
  if (store === undefined) {
    violations.push(`build.${STORE_PROFILE} profile is missing`);
  } else {
    violations.push(...storeProfileViolations(store));
  }
  if (profiles[PREVIEW_PROFILE]?.autoIncrement !== true) {
    violations.push(`${PREVIEW_PROFILE}: autoIncrement must be true`);
  }
  violations.push(...channelViolations(profiles), ...appViolations(app));
  return violations;
}
