import { randomUUID } from "expo-crypto";

import type { IdGenerator } from "../services/id/id-generator";

export const expoCryptoIdGenerator: IdGenerator = {
  newId: () => randomUUID().toLowerCase(),
};
