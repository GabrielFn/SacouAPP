/** The public Web config of the Firebase project (not a secret: it identifies the project to the browser). */
export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
}

/** What the server hands the script, in `data-` attributes of the page's root: never an inline script (CSP). */
export interface PageConfig {
  readonly code: string;
  readonly firebase: FirebaseWebConfig;
  readonly nicknameMaxCodePoints: number;
}

export type DatasetLike = Readonly<Record<string, string | undefined>>;

const CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

function text(dataset: DatasetLike, key: string): string | null {
  const value = dataset[key]?.trim() ?? "";
  return value === "" ? null : value;
}

/** The config, or null when a piece is missing (a machine without the Firebase Web config): the page stays read-only. */
export function readPageConfig(dataset: DatasetLike): PageConfig | null {
  const code = text(dataset, "code");
  const apiKey = text(dataset, "firebaseApiKey");
  const authDomain = text(dataset, "firebaseAuthDomain");
  const projectId = text(dataset, "firebaseProjectId");
  const appId = text(dataset, "firebaseAppId");
  const nicknameMax = Number.parseInt(dataset.nicknameMax ?? "", 10);
  if (code === null || !CODE_PATTERN.test(code) || !Number.isInteger(nicknameMax) || nicknameMax <= 0) return null;
  if (apiKey === null || authDomain === null || projectId === null || appId === null) return null;
  return { code, firebase: { apiKey, authDomain, projectId, appId }, nicknameMaxCodePoints: nicknameMax };
}
