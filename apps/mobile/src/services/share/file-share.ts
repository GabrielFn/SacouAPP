import type { Result } from "@sacou/volley-rules";

/** The phone cannot share a file, or writing it failed: the screen shows one text for both. */
export type FileShareFailure = "unavailable" | "failed";

/**
 * Hands a JSON file to the system share sheet (Drive, WhatsApp, Files): screen 30a. The screens depend on
 * this contract, never on the SDK (frontend.md, rule 3). The text is personal data: never logged.
 */
export interface FileShare {
  /**
   * Writes `text` to a temporary file named `name`, opens the share sheet and deletes the file when the
   * sheet closes, shared or not (E4.3, D9).
   */
  shareJsonFile(name: string, text: string): Promise<Result<null, FileShareFailure>>;
}
