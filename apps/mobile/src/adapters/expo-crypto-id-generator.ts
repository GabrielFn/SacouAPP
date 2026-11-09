import { randomUUID } from "expo-crypto";

import type { IdGenerator } from "../features/court/ports/id-generator";

export const expoCryptoIdGenerator: IdGenerator = {
  newId: () => randomUUID().toLowerCase(),
};
