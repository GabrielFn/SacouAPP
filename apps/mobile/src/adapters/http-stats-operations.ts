import type { SacouApi } from "../services/api/sacou-api";
import type { Client, Execute } from "./http-path-params";

/** The person's own numbers (screen 14), apart from the rest to keep the adapter small (E4.13). */
export function createStatsOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "getMyStats"> {
  return {
    // No `year`: the server uses the current season in America/Sao_Paulo and answers it (`year`).
    getMyStats: () => execute((init) => client.GET("/v1/me/stats", init)),
  };
}
