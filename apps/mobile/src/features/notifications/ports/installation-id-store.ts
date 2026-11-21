/**
 * The id of this install of the app (a random UUID), the key of the phone on the server's list of
 * push devices. It outlives the sessions: another login on the same phone takes the same row over.
 */
export interface InstallationIdStore {
  /** `null` when this install never registered for pushes. */
  read(): Promise<string | null>;
  /** The id, made and kept the first time. */
  readOrCreate(): Promise<string>;
}
