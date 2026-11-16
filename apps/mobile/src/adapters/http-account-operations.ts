import { apiOk } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import type { Client, Execute } from "./http-path-params";

/** Exporting and deleting the account (screens 30a and 30b, ADR 0056), apart to keep the adapter small. */
export function createAccountOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "exportMyData" | "getDeletionBlockers" | "deleteMyAccount"> {
  return {
    exportMyData: () => execute((init) => client.GET("/v1/me/export", init)),
    async getDeletionBlockers() {
      const result = await execute((init) => client.GET("/v1/me/deletion-blockers", init));
      return result.ok ? apiOk(result.value.blockers) : result;
    },
    async deleteMyAccount() {
      const result = await execute((init) => client.DELETE("/v1/me", init));
      return result.ok ? apiOk(null) : result;
    },
  };
}
