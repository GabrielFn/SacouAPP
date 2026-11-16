import { err, ok, type Result } from "@sacou/volley-rules";

import { apiErrorText } from "../../../services/api/api-error-text";
import type { ApiError } from "../../../services/api/api-error";
import type { SacouApi } from "../../../services/api/sacou-api";
import type { FileShare, FileShareFailure } from "../../../services/share/file-share";
import { strings } from "../../../strings/pt-BR";

const FILE_PREFIX = "sacou-meus-dados-";
const FILE_EXTENSION = ".json";
const DATE_PART_LENGTH = 2;
const JSON_INDENT = 2;

const pad = (value: number) => String(value).padStart(DATE_PART_LENGTH, "0");

/** `sacou-meus-dados-2026-11-15.json`: the day on the phone, and nothing of the person (E4.3, D9). */
export function exportFileName(now: Date): string {
  const day = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${FILE_PREFIX}${day}${FILE_EXTENSION}`;
}

export type ExportFailure =
  | { readonly kind: "api"; readonly error: ApiError }
  | { readonly kind: "share"; readonly failure: FileShareFailure };

export interface ExportDeps {
  readonly api: Pick<SacouApi, "exportMyData">;
  readonly fileShare: FileShare;
  readonly now: () => Date;
}

/**
 * "Gerar arquivo": asks the server for the document and hands it to the share sheet as a file. The
 * document goes nowhere else: not to the query cache, not to the result (E4.3, D9).
 */
export async function exportMyData(deps: ExportDeps): Promise<Result<null, ExportFailure>> {
  const answer = await deps.api.exportMyData();
  if (!answer.ok) return err({ kind: "api", error: answer.error });
  const text = JSON.stringify(answer.value, null, JSON_INDENT);
  const shared = await deps.fileShare.shareJsonFile(exportFileName(deps.now()), text);
  return shared.ok ? ok(null) : err({ kind: "share", failure: shared.error });
}

export function exportFailureText(failure: ExportFailure): string {
  return failure.kind === "api"
    ? apiErrorText(failure.error)
    : strings.account.exportSheet.shareUnavailable;
}
