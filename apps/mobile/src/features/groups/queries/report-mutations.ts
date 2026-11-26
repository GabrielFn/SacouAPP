import { unwrap } from "../../../services/api/api-result";
import type { ContentReportBody, SacouApi } from "../../../services/api/sacou-api";

/**
 * "Enviar denúncia" (E6.6): one call, nothing in the cache changes (nobody in the app reads the reports). The status
 * of this mutation is the state of the sheet: pending keeps the button off, an error keeps the sheet open with the
 * reason, a success closes it and shows "Denúncia enviada" (frontend.md, rule 1: no flag of its own).
 */
export function reportContentMutation(api: SacouApi, groupId: string) {
  return {
    mutationFn: async (body: ContentReportBody) => {
      await unwrap(api.reportContent(groupId, body));
    },
  };
}
