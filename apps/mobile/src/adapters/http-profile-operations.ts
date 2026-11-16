import type { SacouApi } from "../services/api/sacou-api";
import type { Client, Execute } from "./http-path-params";

/** The person's own profile (screen 27), apart from the rest to keep the adapter small (E4.3, part 2). */
export function createProfileOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "getMyProfile" | "saveMyProfile"> {
  return {
    getMyProfile: () => execute((init) => client.GET("/v1/me/profile", init)),
    saveMyProfile: (body) =>
      execute((init) => client.PUT("/v1/me/profile", { ...init, body: { ...body } })),
  };
}
