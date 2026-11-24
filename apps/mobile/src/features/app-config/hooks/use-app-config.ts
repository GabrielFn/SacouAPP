import { useQuery } from "@tanstack/react-query";

import type { AppConfig } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { isFeatureOn, type AppFeature } from "../model/app-config";
import { appConfigQuery } from "../queries/app-config-queries";

/** The config of the API, or `undefined` while there is no answer, from the network or the persisted cache. */
export function useAppConfig(): AppConfig | undefined {
  const { sacouApi } = useServices();
  return useQuery(appConfigQuery(sacouApi)).data;
}

/** A flag, derived on each render from the one record: never stored apart. */
export function useFeatureOn(feature: AppFeature): boolean {
  return isFeatureOn(useAppConfig(), feature);
}
